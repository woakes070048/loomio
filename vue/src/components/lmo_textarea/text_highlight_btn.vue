<script lang="js">
import colors from 'vuetify/lib/util/colors';
import { pick } from 'lodash-es';

export default
{
  props: {
    editor: Object
  },

  data() {
    return {colors: pick(colors, "red pink purple blue green yellow orange brown grey".split(" "))};
  },

  computed: {
    activeColorKey() {
      if (!this.editor.isActive('highlight')) { return null; }
      return Object.keys(this.colors).find(name => this.editor.isActive('highlight', {color: name}));
    },

    buttonBgColor() {
      return (this.colors[this.activeColorKey] || {lighten1: null}).lighten2;
    },
    buttonFgColor() {
      if (this.buttonBgColor) {
        return '#000';
      } else {
        return undefined;
      }
    }
  }
};
</script>

<template lang="pug">
v-menu
  template(v-slot:activator="{ props }")
    div.rounded-lg.color-picker-btn
      v-btn.drop-down-button(
        size="x-small" icon variant="text"
        :style="{'background-color': buttonBgColor, color: buttonFgColor}" 
        v-bind="props"
        :title="$t('formatting.colors')"
      )
        common-icon(size="small" name="mdi-palette")
  v-card.color-picker.pa-2
    .swatch.swatch-color(v-for="(value, key) in colors"
                         :class="{'swatch--selected': key == activeColorKey }"
                         :style="{'background-color': value.lighten1}"
                         @click="editor.chain().setHighlight({color: key}).focus().run()") &nbsp;
    v-btn.mt-2(block size="x-small" outlined @click="editor.chain().unsetHighlight().focus().run()" v-t="'formatting.reset'")
</template>

<style lang="sass">

.color-picker-btn
  padding-left: 1px

.color-picker
  width: 250px

.swatch
  box-sizing: border-box
  display: inline-block
  width: 24px
  height: 24px
  margin: 1px
  border: 1px solid transparent
  border-radius: 2px
  transition: border-radius 0.1s linear

.swatch--color
  // border-radius: 24px
  border: 2px solid transparent

.swatch--white
  border: 2px solid #ddd

.swatch--selected
  border-radius: 24px

.swatch:hover
  cursor: pointer
  border-radius: 8px

.swatch-active
  border-radius: 24px
</style>
