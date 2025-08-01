import utils from './utils';
import { isEqual } from 'date-fns';
import { camelCase, compact, union, each, isArray, keys, filter, snakeCase, defaults, orderBy, assign, includes, pick } from 'lodash-es';

import Records from '@/shared/services/records';
import { reactive } from 'vue';

function attributeIsDifferent(first, second, attributeName) {
  if (utils.isTimeAttribute(attributeName)) {
    return !((first === second) || isEqual(first, second));
  } else {
    return first !== second;
  }
}

export default class BaseModel {
  static singular = 'undefinedSingular';
  static plural = 'undefinedPlural';

  static eventTypeMap = {
    Group: 'groups',
    Discussion: 'discussions',
    Poll: 'polls',
    Outcome: 'outcomes',
    Stance: 'stances',
    Comment: 'comments',
    CommentVote: 'comments',
    Membership: 'memberships',
    MembershipRequest: 'membershipRequests',
    DiscussionTemplate: 'discussionTemplates',
    PollTemplate: 'pollTemplates',
  };

  // indicate to Loki our 'primary keys' - it promises to make these fast to lookup by.
  static uniqueIndices = ['id'];

  // list of other attributes to index
  static indices = [];

  static searchableFields = [];

  // whitelist of attributes to include when serializing the record.
  // leave null to serialize all attributes
  static serializableAttributes = null;

  // what is the key to use when serializing the record?
  static serializationRoot = null;

  constructor(attributes) {
    this.inCollection = this.inCollection.bind(this);
    this.remove = this.remove.bind(this);
    this.destroy = this.destroy.bind(this);
    this.beforeDestroy = this.beforeDestroy.bind(this);
    this.beforeRemove = this.beforeRemove.bind(this);
    this.discard = this.discard.bind(this);
    this.undiscard = this.undiscard.bind(this);
    this.save = this.save.bind(this);
    this.saveSuccess = this.saveSuccess.bind(this);
    this.saveError = this.saveError.bind(this);
    this.setErrors = this.setErrors.bind(this);
    if (attributes == null) { attributes = {}; }
    this.processing = false; // not returning/throwing on already processing rn
    this._version = 0;
    this.attributeNames = [];
    // this.unmodified = {};
    // this.afterUpdateFns = [];
    this.saveDisabled = false;
    this.saveFailed = false;
    this.beforeSaves = [];
    this.errors = [];
    this.setErrors();
    if (this.relationships != null) { this.buildRelationships(); }
    this.update(this.defaultValues());
    this.update(attributes);
    this.afterConstruction();
  }

  collabKeyParams() {
    return [];
  }

  collabKey(field, userId) {
    return compact((this.isNew() ?
      [this.constructor.singular, 'new', userId, this.collabKeyParams(), field]
    :
      [this.constructor.singular, this.id, field]
    ).flat()).join("-");
  }

  // bumpVersion() {
  //   return this._version = this._version + 1;
  // }

  afterConstruction() {}

  defaultValues() { return {}; }

  clone() {
    const cloneAttributes = {};
    each(this.attributeNames, attr => {
      if (isArray(this[attr])) {
        cloneAttributes[attr] = this[attr].slice(0);
      } else {
        cloneAttributes[attr] = this[attr];
      }
      return true;
    });
    return new this.constructor(cloneAttributes);
  }

  inCollection() {
    return this['$loki'];
  }

  update(attributes) {
    return this.baseUpdate(attributes);
  }

  // afterUpdate(fn) {
  //   return this.afterUpdateFns.push(fn);
  // }

  baseUpdate(attributes) {
    // this.bumpVersion();

    this.attributeNames = union(this.attributeNames, keys(attributes));
    each(attributes, (value, key) => {
      // if (attributeIsDifferent(this[key], value, key)) {
        reactive(this)[key] = value;
      // }
      return true;
    });

    if (this.inCollection()) { Records[this.constructor.plural].collection.update(this); }

    // return this.afterUpdateFns.forEach(fn => fn(this));
  }


  attributeIsBlank(attributeName) {
    const doc = new DOMParser().parseFromString(this[attributeName], 'text/html');
    const o = (doc.body.textContent || "").trim();
    return ['null', 'undefined', ''].includes(o);
  }

  // attributeIsModified(attributeName) {
  //   const strip = function(val) {
  //     const doc = new DOMParser().parseFromString(val, 'text/html');
  //     const o = (doc.body.textContent || "").trim();
  //     if (['null', 'undefined'].includes(o)) {
  //       return '';
  //     } else {
  //       return o;
  //     }
  //   };

  //   const original = this.unmodified[attributeName];
  //   const current = this[attributeName];
  //   if (utils.isTimeAttribute(attributeName)) {
  //     return !((original === current) || isEqual(original, current));
  //   } else {
  //     if (strip(original) === strip(current)) { return false; }
  //     // console.log("#{attributeName}: #{strip(original)}, #{strip(current)}")
  //     return original !== current;
  //   }
  // }

  // modifiedAttributes() {
  //   return filter(this.attributeNames, name => {
  //     return this.attributeIsModified(name);
  //   });
  // }

  // isModified() {
  //   return this.modifiedAttributes().length > 0;
  // }

  serialize() {
    return this.baseSerialize();
  }

  baseSerialize() {
    const wrapper = {};
    const data = {};
    const paramKey = snakeCase(this.constructor.serializationRoot || this.constructor.singular);

    if (this._destroy) { data._destroy = this._destroy; }
    each(this.constructor.serializableAttributes || this.attributeNames, attributeName => {
      const snakeName = snakeCase(attributeName);
      const camelName = camelCase(attributeName);
      if (utils.isTimeAttribute(camelName) && this[camelName]) {
        data[snakeName] = this[camelName].toISOString();
      } else {
        data[snakeName] = this[camelName];
      }
      return true;
    }); // so if the value is false we don't break the loop

    wrapper[paramKey] = data;
    return wrapper;
  }

  relationships() {}

  buildRelationships() {
    this.views = {};
    return this.relationships();
  }

  hasMany(name, userArgs) {
    if (userArgs == null) { userArgs = {}; }
    const args = defaults(userArgs, {
      from: name,
      with: this.constructor.singular + 'Id',
      of: 'id',
      find: {}
    });

    return this[name] = () => {
      const find = Object.assign({}, {[args.with]: this[args.of]},  args.find);
      if (userArgs.orderBy) {
        return orderBy(Records[args.from].find(find), userArgs.orderBy);
      } else {
        return Records[args.from].find(find);
      }
    };
  }

  belongsTo(name, userArgs) {
    const values = {
      from: name + 's',
      by: name + 'Id'
    };

    const args = assign(values, userArgs);

    this[name] = () => {
      if (this[args.by]) {
        let obj;
        if (obj = Records[args.from].find(this[args.by])) { return obj; }
        if (this.constructor.lazyLoad) {
          obj = Records[args.from].create({id: this[args.by]});
          Records[args.from].addMissing(this[args.by]);
          return obj;
        }
      }
      return Records[args.from].nullModel();
    };
    this[name+'Is'] = obj => Records[args.from].find(this[args.by]) === obj;
  }

  belongsToPolymorphic(name) {

    this[name] = () => {
      const typeColumn = `${name}Type`;
      const idColumn = `${name}Id`;

      return Records[BaseModel.eventTypeMap[this[typeColumn]]].find(this[idColumn]);
    };
  }

  translationOptions() {}

  isA(...models) {
    return includes(models, this.constructor.singular);
  }

  namedId() {
    return { [`${this.constructor.singular}_id`]: this.id };
  }

  bestNamedId() {
    return this.namedId();
  }

  isNew() {
    return (this.id == null);
  }

  keyOrId() {
    if (this.key != null) {
      return this.key;
    } else {
      return this.id;
    }
  }

  remove() {
    this.beforeRemove();
    if (this.inCollection()) {
      return Records[this.constructor.plural].collection.remove(this);
    }
  }

  destroy() {
    reactive(this).processing = true;
    this.beforeDestroy();
    this.remove();
    return Records[this.constructor.plural].remote.destroy(this.keyOrId())
    .finally(() => {
      reactive(this).processing = false;
    });
  }

  beforeDestroy() {}

  beforeRemove() {}

  discard() {
    reactive(this).processing = true;
    return Records[this.constructor.plural].remote.discard(this.keyOrId())
    .finally(() => {
      reactive(this).processing = false;
    });
  }

  undiscard() {
    reactive(this).processing = true;
    return Records[this.constructor.plural].remote.undiscard(this.keyOrId())
    .finally(() => {
      reactive(this).processing = false;
    });
  }

  beforeSave() { return true; }

  save() {
    reactive(this).processing = true;
    this.beforeSave();
    this.beforeSaves.forEach(f => f());
  
    if (this.isNew()) {
      return Records[this.constructor.plural].remote.create(this.serialize())
      .then(this.saveSuccess, this.saveError)
      .finally(() => { reactive(this).processing = false; });
    } else {
      return Records[this.constructor.plural].remote.update(this.keyOrId(), this.serialize())
      .then(this.saveSuccess, this.saveError)
      .finally(() => { reactive(this).processing = false; });
    }
  }

  saveSuccess(data) {
    reactive(this).saveFailed = false;
    // this.unmodified = pick(this, this.attributeNames);
    return data;
  }

  saveError(data) {
    reactive(this).saveFailed = true;
    this.setErrors(data.errors);
    throw data;
  }

  // discardChanges() {
  //   reactive(this).attributeNames.forEach(key => {
  //     reactive(this)[key] = this.unmodified[key];
  //   });
  // }

  setErrors(errorList) {
    if (errorList == null) { errorList = []; }
    reactive(this).errors = {}

    each(errorList, (errors, key) => {
      reactive(this).errors[camelCase(key)] = errors
      return true
    });
  }

  isValid() {
    return this.errors.length > 0;
  }

  edited() {
    return this.versionsCount > 1;
  }
};
