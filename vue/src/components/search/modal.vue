<script lang="js">
import Session        from '@/shared/services/session';
import Records        from '@/shared/services/records';
import EventBus        from '@/shared/services/event_bus';
import Flash   from '@/shared/services/flash';
import { I18n } from '@/i18n';
import { mdiMagnify, mdiClose } from '@mdi/js';

export default {
  props: {
    initialOrgId: {
      required: false,
      default: null,
      type: Number
    },
    initialGroupId: {
      required: false,
      default: null,
      type: Number
    },
    initialType: {
      required: false,
      default: null,
      type: String
    },
    initialQuery: {
      required: false,
      default: null,
      type: String
    }
  },

  created() {
    this.orgId = this.initialOrgId;
    this.groupId = this.initialGroupId;
    this.type = this.initialType;
  },

  data() {
    return {
      mdiMagnify,
      mdiClose,
      loading: false,
      query: this.initialQuery,
      results: [],
      users: {},
      type: null,
      typeItems: [
        {title: I18n.global.t('search_modal.all_content'), value: null},
        {title: I18n.global.t('group_page.threads'), value: 'Discussion'},
        {title: I18n.global.t('navbar.search.comments'), value: 'Comment'},
        {title: I18n.global.t('group_page.decisions'), value: 'Poll'},
        {title: I18n.global.t('poll_common.votes'), value: 'Stance'},
        {title: I18n.global.t('poll_common.outcomes'), value: 'Outcome'},
      ],
      orgItems: [
        {title: I18n.global.t('sidebar.all_groups'), value: null},
        {title: I18n.global.t('sidebar.invite_only_threads'), value: 0}
      ].concat(Session.user().parentGroups().map(g => ({
        title: g.name,
        value: g.id
      }))),
      orgId: null,
      groupItems: [],
      groupId: null,
      order: null,
      orderItems: [
        {title: I18n.global.t('search_modal.best_match'), value: null},
        {title: I18n.global.t('strand_nav.newest'), value: "authored_at_desc"},
        {title: I18n.global.t('strand_nav.oldest'), value: "authored_at_asc"},
      ],
      tag: null,
      tagItems: [],
      group: null,
      resultsQuery: null
    };
  },

  methods: {
    userById(id) { return Records.users.find(id); },
    pollById(id) { return Records.polls.find(id); },
    groupById(id) { return Records.groups.find(id); },

    fetch() {
      if (!this.query) {
        this.results = [];
      } else {
        this.loading = true;
        this.resultsQuery = this.query;
        Records.remote.get('search', {
          query: this.query,
          type: this.type,
          org_id: this.orgId,
          group_id: this.groupId,
          order: this.order,
          tag: this.tag
        }).then(data => {
          this.results = data.search_results;
          this.lastQuery = this.query;
        }).finally(() => {
          this.loading = false;
        });
      }
    },

    urlForResult(result) {
      switch (result.searchable_type) {
        case 'Discussion':
          return `/d/${result.discussion_key}/${this.stub(result.discussion_title)}`;
        case 'Comment':
          return `/d/${result.discussion_key}/comment/${result.searchable_id}`;
        case 'Poll': case 'Outcome': case 'Stance':
          if (result.sequence_id) {
            return `/d/${result.discussion_key}/${this.stub(result.discussion_title)}/${result.sequence_id}`;
          } else {
            return `/p/${result.poll_key}/${this.stub(result.poll_title)}`;
          }
        default:
          return '/notdefined';
      }
    },

    stub(name) {
      return name.replace(/[^a-z0-9\-_]+/gi, '-').replace(/-+/g, '-').toLowerCase();
    },

    closeModal() {
      EventBus.$emit('closeModal');
    },

    updateTagItems(group) {
      this.tagItems = [{title: I18n.global.t('search_modal.any_tag'), value: null}].concat(group.tagsByName().map(t => ({
        title: t.name,
        value: t.name
      })));
    }
  },

  watch: {
    orgId(newval, oldval){
      if (this.orgId) {
        this.group = Records.groups.find(this.orgId);
        const base = [
          {title: I18n.global.t('search_modal.all_subgroups'), value: null},
          {title: I18n.global.t('search_modal.parent_only'), value: this.orgId},
        ];
        this.updateTagItems(this.group);
        this.groupItems = base.concat(this.group.subgroups().filter(g => !g.archivedAt && g.membershipFor(Session.user())).map(g => ({
          title: g.name,
          value: g.id
        })));
      } else {
        this.groupItems = [];
        this.tagItems = [];
      }
      this.fetch();
    },

    groupId(groupId) {
      if (groupId) {
        const group = Records.groups.find(groupId);
        this.updateTagItems(group);
      }
      this.fetch();
    },
    type() { this.fetch(); },
    order() { this.fetch(); },
    tag() { this.fetch(); },

    '$route.path': 'closeModal'
  }
};

</script>
<template lang="pug">
v-card.search-modal(:title="$t('common.action.search')")
  template(v-slot:append)
    dismiss-modal-button
  v-card-text
    .d-flex.align-center
      v-text-field(
        :prepend-inner-icon="mdiMagnify"
        color="info"
        variant="solo-filled"
        :loading="loading"
        autofocus
        v-model="query"
        @keydown.enter.prevent="fetch"
        hide-details
        )

    .d-flex.align-center.pt-4
      v-select.mr-2(variant="solo-filled" density="compact" v-model="orgId" :items="orgItems")
      v-select.mr-2(variant="solo-filled" density="compact" v-if="groupItems.length > 2" v-model="groupId" :items="groupItems" :disabled="!orgId")
      v-select.mr-2(variant="solo-filled" density="compact" v-if="tagItems.length" v-model="tag" :items="tagItems")
      v-select.mr-2(variant="solo-filled" density="compact" v-model="type" :items="typeItems")
      v-select(variant="solo-filled" density="compact" v-model="order" :items="orderItems")
    v-list(lines="two")
      v-list-item.poll-common-preview(v-if="!loading && resultsQuery && results.length == 0")
        v-list-item-title(v-t="{path: 'discussions_panel.no_results_found', args: {search: resultsQuery}}")
      v-list-item(v-for="result in results" :key="result.id" :to="urlForResult(result)")
        template(v-slot:prepend)
          poll-common-icon-panel.mr-2(v-if="['Outcome', 'Poll'].includes(result.searchable_type)" :poll='pollById(result.poll_id)' show-my-stance)
          user-avatar.mr-2(v-else :user="userById(result.author_id)")
        v-list-item-title.d-flex
          span.text-truncate {{ result.poll_title || result.discussion_title }}
          tags-display.ml-1(:tags="result.tags" size="x-small" :group="groupById(result.group_id)")
          v-spacer
          time-ago.text-medium-emphasis(style="font-size: 0.875rem;" :date="result.authored_at")
        v-list-item-subtitle.text--primary(v-html="result.highlight")
        v-list-item-subtitle
          span
            span {{result.searchable_type}}
            mid-dot
            span {{result.author_name}}
            mid-dot
            span {{result.group_name || $t('discussion.invite_only')}}

</template>
