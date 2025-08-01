pageHelper = require('../helpers/pageHelper')

module.exports = {
  'displays_parent_group_in_sidebar_if_member_of_a_subgroup': (test) => {
    page = pageHelper(test)

    page.loadPath('visit_group_as_subgroup_member')
    page.expectText('.group-page__name', 'Point Break')
    page.expectElement('.join-group-button')
    page.ensureSidebar()
    page.expectText('.sidebar__groups', 'Point Break')
  },

  'should_allow_you_to_join_an_open_group': (test) => {
    page     = pageHelper(test)

    page.loadPath('view_open_group_as_visitor')
    page.click('.join-group-button')
    page.signUpViaEmail('new@account.com')
    page.pause(500)
    page.click('.join-group-button', 500)
    page.ensureSidebar()
    page.expectText('.sidenav-left', 'Open Dirty Dancing Shoes')
  },

  'does_not_allow_mark_as_read_or_mute': (test) => {
    page = pageHelper(test)

    page.loadPath('view_open_group_as_visitor')
    page.expectNoElement('.thread-preview__dismiss')
    page.expectNoElement('.thread-preview__mute')
  },

  'join_an_open_group': (test) => {
    page = pageHelper(test)

    page.loadPath('view_open_group_as_non_member')
    page.click('.join-group-button')
    page.expectFlash('You are now a member')
  },

  'request_to_join_a_closed_group': (test) => {
    page = pageHelper(test)

    page.loadPath('view_closed_group_as_non_member')
    page.click('.join-group-button')
    page.fillIn('.membership-request-form__introduction textarea', 'I have a reason')
    page.click('.membership-request-form__submit-btn')
    page.expectFlash('You have requested to join')
  },

  'secret_group': (test) => {
    page = pageHelper(test)

    page.loadPath('view_secret_group_as_non_member')
    page.expectElement('.error-page')
  },

  'displays_threads_from_subgroups_in_the_discussions_card': (test) => {
    page = pageHelper(test)

    page.loadPath('setup_group_with_subgroups')
    page.expectText('.discussions-panel__list', 'Vaya con dios', 20000)
  },

  'closed_subgroup_whose_parent_members_can_see_private_threads': (test) => {
    page = pageHelper(test)

    page.loadPath('setup_subgroup_with_parent_member_visibility')
    page.pause(2000)
    page.expectText('.discussions-panel__list', 'Vaya con dios', 20000)
  },

  'starts_a_secret_group': (test) => {
    page = pageHelper(test)

    page.loadPath('setup_dashboard')
    page.ensureSidebar()

    page.click('.sidebar-start-group')

    page.fillIn('.group-form__name input', 'Secret please')
    page.click('.group-form__category-select .v-field')
    page.click('.v-overlay .v-select__content .v-list-item')
    page.click('.group-form__submit-button')
    page.expectFlash('Group started')
  },

  'open_subgroup': (test) => {
    page = pageHelper(test)

    page.loadPath('setup_open_group')
    page.ensureSidebar()
    page.click('.sidebar-start-subgroup')

    page.fillIn('#group-name', 'Open please')
    page.click('.group-form__privacy-open')
    page.expectElement('.group-form__joining')
    page.click('.group-form__submit-button')
    page.expectFlash('Group started')

    page.click('.action-menu')
    page.click('.action-dock__button--edit_group')
    page.pause(200)
    page.click('.group-form__permissions-tab')

    page.expectNoElement('.group-form__parent-members-can-see-discussions')
  },

  'closed_subgroup': (test) => {
    page = pageHelper(test)

    page.loadPath('setup_open_group')
    page.ensureSidebar()
    page.click('.sidebar-start-subgroup')

    page.fillIn('#group-name', 'Closed please')
    page.click('.group-form__privacy-closed')
    page.expectNoElement('.group-form__joining')
    page.click('.group-form__submit-button')
    page.expectFlash('Group started')

    page.click('.action-menu')
    page.click('.action-dock__button--edit_group')
    page.click('.group-form__permissions-tab')

    page.expectElement('.group-form__parent-members-can-see-discussions')
  },

  'secret_subgroup': (test) => {
    page = pageHelper(test)

    page.loadPath('setup_open_group')
    page.ensureSidebar()
    page.click('.sidebar-start-subgroup')
    page.fillIn('#group-name', 'Secret please')
    page.click('.group-form__privacy-secret')
    page.expectNoElement('.group-form__joining')
    page.click('.group-form__submit-button')
    page.expectFlash('Group started')

    page.click('.action-menu')
    page.click('.action-dock__button--edit_group')
    page.click('.group-form__permissions-tab')

    page.expectNoElement('.group-form__parent-members-can-see-discussions')
  },

  'successfully_edits_group_name_and_description': (test) => {
    page = pageHelper(test)

    page.loadPath('setup_group')
    page.click('.action-menu')
    page.click('.action-dock__button--edit_group')

    page.fillIn('#group-name', 'Clean Dancing Shoes')
    page.fillIn('.group-form__group-description .lmo-textarea textarea', 'Dusty sandles')
    page.click('.group-form__submit-button')

    page.pause(500)
    page.expectText('.group-page__name', 'Clean Dancing Shoes')
  },

  // TODO reenable when clearValue bug is fixed
  // 'displays_a_validation_error_when_name_is_blank': (test) => {
  //   page = pageHelper(test)
  //
  //   page.loadPath('setup_group')
  //   page.click('.action-dock__button--button')
  //   page.click('.action-dock__button--edit-group-link')
  //   page.fillIn('.group-form__name input', '') // TODO: GK: setValue is not clearing the input
  //   page.click('.group-form__submit-button')
  //   page.pause()
  //   page.expectText('.lmo-validation-error', "can't be blank")
  // },

  // 'can_be_a_very_open_group': (test) => {
  //   page = pageHelper(test)
  //
  //   page.loadPath('setup_group')
  //
  //   page.click('.action-menu')
  //   page.click('.action-dock__button--edit_group')
  //
  //   page.click('.group-form__privacy-tab')
  //   page.click('.group-form__privacy-open')
  //   page.click('.group-form__membership-granted-upon-request')
  //
  //   page.click('.group-form__permissions-tab')
  //   page.click('.group-form__members-can-create-subgroups label')
  //   page.click('.group-form__submit-button')
  //
  //   // confirm privacy change
  //   page.acceptConfirm()
  //
  //   // reopen form
  //   page.click('.action-menu')
  //   page.click('.action-dock__button--edit_group')
  //
  //
  //   // confirm the settings have stuck
  //   page.click('.group-form__privacy-tab')
  //   page.expectElement('.group-form__privacy-open input[aria-checked="true"]')
  //   page.click('.group-form__permissions-tab')
  //   page.expectElement('.group-form__membership-granted-upon-request input[aria-checked="true"]')
  //   page.expectElement('.group-form__members-can-add-members input[aria-checked="true"]')
  //   page.expectElement('.group-form__members-can-create-subgroups input[aria-checked="true"]')
  // },

  // 'can_be_a_very_locked_down_group': (test) => {
  //   page = pageHelper(test)
  //
  //   page.loadPath('setup_group')
  //   page.click('.action-menu')
  //   page.click('.action-dock__button--edit_group')
  //
  //   page.click('.group-form__privacy-tab')
  //   page.click('.group-form__privacy-secret')
  //   page.click('.group-form__permissions-tab')
  //
  //   page.click('.group-form__members-can-start-discussions label')
  //   page.click('.group-form__members-can-edit-discussions label')
  //   page.click('.group-form__members-can-edit-comments label')
  //   page.click('.group-form__members-can-raise-motions label')
  //   page.click('.group-form__members-can-vote label')
  //
  //   page.click('.group-form__submit-button')
  //
  //   // confirm privacy change
  //   page.acceptConfirm()
  //
  //   page.pause(500)
  //
  //   // reopen form
  //   page.click('.action-menu', 500)
  //   page.click('.action-dock__button--edit_group', 500)
  //
  //   // confirm the settings have stuck
  //   page.click('.group-form__privacy-tab', 500)
  //   page.expectElement('.group-form__privacy-secret input[aria-checked="true"]')
  //
  //   page.click('.group-form__permissions-tab')
  //   page.expectNoElement('.group-form__members-can-start-discussions input[aria-checked="true"]')
  //   page.expectNoElement('.group-form__members-can-edit-discussions input[aria-checked="true"]')
  //   page.expectNoElement('.group-form__members-can-edit-comments input[aria-checked="true"]')
  //   page.expectNoElement('.group-form__members-can-raise-motions input[aria-checked="true"]')
  //   page.expectNoElement('.group-form__members-can-vote input[aria-checked="true"]')
  // },

  'allows_group_members_to_leave_the_group': (test) => {
    page = pageHelper(test)

    page.loadPath('setup_group_with_multiple_coordinators')
    page.click('.action-menu')
    page.click('.action-dock__button--leave_group')
    page.click('.confirm-modal__submit')
    page.expectFlash('You have left this group')
    page.expectText('.dashboard-page__empty', 'Welcome! You are not a member of any groups yet.')
  },

  'starts_a_discussion': (test) => {
    page = pageHelper(test)

    page.loadPath('setup_group')
    page.click('.discussions-panel__new-thread-button')
    page.click('.thread-templates--template')
    page.fillIn('#discussion-title', 'Nobody puts baby in a corner')
    page.fillIn('.discussion-form .lmo-textarea div[contenteditable=true]', "I've had the time of my life")
    page.click('.discussion-form__submit')
    page.expectFlash("Thread started")
    page.expectText('.context-panel__heading', 'Nobody puts baby in a corner' )
    page.expectText('.context-panel__description', "I've had the time of my life" )
  },

  'lets_you_change_membership_volume': (test) => {
    page = pageHelper(test)

    page.loadPath('setup_group')
    page.click('.action-menu')
    page.click('.action-dock__button--change_volume')

    page.click('.volume-loud label')
    page.click('.change-volume-form__submit')
    page.expectFlash('Notification settings updated')
  },

  'create_tag': (test) => {
    page = pageHelper(test)

    page.loadPath('setup_group')
    page.click('.action-menu')
    page.click('.action-dock__button--edit_tags')
    page.click('.tag-form__new-tag')
    page.fillIn('.tags-modal__tag-name input', "important")
    page.click('.tag-form__submit')
    page.expectText('.tags-modal .v-chip__content', 'important' )
  },

  'delete_group': (test) => {
    page = pageHelper(test)

    page.loadPath('setup_group_super_admin')
    page.click('.action-menu')
    page.click('.action-dock__button--destroy_group')

    page.fillIn('.confirm-text-field input', 'shoes')
    page.click('.confirm-modal__submit')
    page.expectFlash("This group has been archived and is scheduled for permanent deletion in 2 weeks.")
  }
}
