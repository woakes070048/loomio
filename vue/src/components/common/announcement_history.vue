<script lang="js">
import Records        from '@/shared/services/records';
import EventBus       from '@/shared/services/event_bus';
import utils          from '@/shared/record_store/utils';
import LmoUrlService  from '@/shared/services/lmo_url_service';
import AbilityService from '@/shared/services/ability_service';
import Session from '@/shared/services/session';
import AppConfig from '@/shared/services/app_config';
import Flash   from '@/shared/services/flash';
import { encodeParams } from '@/shared/helpers/encode_params';

export default {
  props: {
    close: Function,
    model: {
      type: Object,
      required: true
    }
  },

  data() {
    return {
      historyData: [],
      historyLoading: false,
      historyError: false,
      allowViewed: false
    };
  },

  created() {
    this.historyLoading = true;
    Records.fetch({
      path: 'announcements/history',
      params: this.model.namedId()}).
    then(data => {
      this.historyLoading = false;
      this.historyData = data.data || [];
      this.allowViewed = data.allow_viewed;
    }
    , err => {
      this.historyLoading = false;
      this.historyError = true;
    });
  },

  computed: {
    modelKind() { return this.model.constructor.singular; },
    pollType() { return this.model.pollType; },
    translatedPollType() {
      if (this.model.isA('poll') || this.model.isA('outcome')) {
        return this.model.poll().translatedPollType(); 
      }
    }
  }
};
</script>

<template lang="pug">
v-card(:title="$t('announcement.' + modelKind + '_notification_history')")
  template(v-slot:append)
    dismiss-modal-button
  .d-flex.justify-center
    v-progress-circular(color="primary" v-if="historyLoading" indeterminate)
  v-card-text.text-body-2(v-if="!historyLoading")
    p(v-if="historyError && historyData.length == 0" v-t="'announcement.history_error'")
    p(v-if="!historyError && historyData.length == 0" v-t="'announcement.no_notifications_sent'")
    p(v-if="historyData.length && allowViewed" v-t="'announcement.notification_history_explanation'")
    div(v-for="event in historyData" :key="event.id")
      h4.mt-4.mb-2
        time-ago(:date="event.created_at")
        mid-dot
        span(v-t="{ path: 'announcement.'+event.kind, args: { name: event.author_name, length: event.notifications.length } }")
      ul(style="list-style-type: none; padding-left: 0")
        li(v-for="notification in event.notifications" :key="notification.id")
          span {{notification.to}}
          space
          span(v-if="notification.viewed") ✓
</template>
