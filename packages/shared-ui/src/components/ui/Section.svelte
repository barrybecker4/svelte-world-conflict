<script lang="ts">
  export let title = '';
  export let subtitle = '';
  export let padding = '16px';
  export let borderBottom = true;
  export let flex = false;
  export let flexDirection = 'column';
  export let gap = '8px';
  export let customClass = '';

  $: classes = [
    'section-base',
    borderBottom && 'section-border',
    flex && 'section-flex',
    customClass
  ].filter(Boolean).join(' ');

  $: sectionStyle = `
    padding: ${padding};
    ${flex ? `display: flex; flex-direction: ${flexDirection}; gap: ${gap};` : ''}
  `;
</script>

<section class={classes} style={sectionStyle}>
  {#if title}
    <div class="section-header">
      <h3 class="section-title">{title}</h3>
      {#if subtitle}
        <p class="section-subtitle">{subtitle}</p>
      {/if}
    </div>
  {/if}

  <div class="section-content">
    <slot />
  </div>

  {#if $$slots.actions}
    <div class="section-actions">
      <slot name="actions" />
    </div>
  {/if}
</section>

<style>
  .section-base {
    flex: 0 0 auto;
    background: transparent;
  }

  .section-border {
    border-bottom: 1px solid #4a5568;
  }

  .section-flex {
    display: flex;
  }

  .section-header {
    margin-bottom: 0.75rem;
  }

  .section-title {
    margin: 0 0 0.25rem 0;
    color: #f8fafc;
    font-size: 1.1rem;
    font-weight: 600;
  }

  .section-subtitle {
    margin: 0;
    color: #94a3b8;
    font-size: 0.9rem;
  }

  .section-content {
    flex: 1;
  }

  .section-actions {
    margin-top: 1rem;
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
  }

  /* Common section variants */
  .section-base.turn-section .section-content {
    background: transparent;
    padding: 0;
    border-radius: 0;
    text-align: center;
  }

  .section-base.stats-section .section-content {
    display: flex;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 6px;
    border: 1px solid #4a5568;
    overflow: hidden;
  }
</style>
