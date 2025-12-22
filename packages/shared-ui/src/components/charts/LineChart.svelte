<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import {
    Chart,
    LineController,
    LineElement,
    PointElement,
    LinearScale,
    CategoryScale,
    Title,
    Tooltip,
    Legend,
    Filler
  } from 'chart.js';

  // Register Chart.js components
  Chart.register(
    LineController,
    LineElement,
    PointElement,
    LinearScale,
    CategoryScale,
    Title,
    Tooltip,
    Legend,
    Filler
  );

  export interface Dataset {
    label: string;
    data: number[];
    color: string;
  }

  interface Props {
    title: string;
    labels: string[];
    datasets: Dataset[];
    height?: string;
  }

  let { title, labels, datasets, height = '250px' }: Props = $props();

  let canvas: HTMLCanvasElement;
  let chart: Chart | null = null;
  let hoveredDatasetIndex: number | null = $state(null);

  function createChart() {
    if (chart) {
      chart.destroy();
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: datasets.map((ds, index) => ({
          label: ds.label,
          data: ds.data,
          borderColor: ds.color,
          backgroundColor: ds.color + '20',
          borderWidth: hoveredDatasetIndex === null || hoveredDatasetIndex === index ? 2 : 1,
          pointRadius: 3,
          pointHoverRadius: 5,
          tension: 0.3,
          fill: false,
          opacity: hoveredDatasetIndex === null || hoveredDatasetIndex === index ? 1 : 0.3
        }))
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            display: false // We'll render our own interactive legend
          },
          title: {
            display: true,
            text: title,
            color: '#f8fafc',
            font: {
              size: 14,
              weight: 'bold'
            }
          },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.9)',
            titleColor: '#f8fafc',
            bodyColor: '#cbd5e1',
            borderColor: '#475569',
            borderWidth: 1,
            padding: 10,
            cornerRadius: 6
          }
        },
        scales: {
          x: {
            grid: {
              color: 'rgba(71, 85, 105, 0.3)'
            },
            ticks: {
              color: '#94a3b8',
              font: {
                size: 10
              }
            }
          },
          y: {
            beginAtZero: true,
            grid: {
              color: 'rgba(71, 85, 105, 0.3)'
            },
            ticks: {
              color: '#94a3b8',
              font: {
                size: 10
              }
            }
          }
        },
        onHover: (_event, elements) => {
          if (elements.length > 0) {
            hoveredDatasetIndex = elements[0].datasetIndex;
          } else {
            hoveredDatasetIndex = null;
          }
        }
      }
    });
  }

  function updateChartOpacity() {
    if (!chart) return;
    
    chart.data.datasets.forEach((ds, index) => {
      const isHighlighted = hoveredDatasetIndex === null || hoveredDatasetIndex === index;
      ds.borderWidth = isHighlighted ? 3 : 1;
      ds.borderColor = datasets[index].color + (isHighlighted ? 'ff' : '40');
    });
    chart.update('none');
  }

  function handleLegendHover(index: number) {
    hoveredDatasetIndex = index;
    updateChartOpacity();
  }

  function handleLegendLeave() {
    hoveredDatasetIndex = null;
    updateChartOpacity();
  }

  onMount(() => {
    createChart();
  });

  onDestroy(() => {
    if (chart) {
      chart.destroy();
    }
  });

  // Recreate chart when data changes
  $effect(() => {
    if (canvas && labels && datasets) {
      createChart();
    }
  });
</script>

<div class="chart-container" style="height: {height}">
  <div class="chart-wrapper">
    <canvas bind:this={canvas}></canvas>
  </div>
  
  <div class="legend">
    {#each datasets as dataset, index}
      <div
        class="legend-item"
        class:highlighted={hoveredDatasetIndex === index}
        class:dimmed={hoveredDatasetIndex !== null && hoveredDatasetIndex !== index}
        onmouseenter={() => handleLegendHover(index)}
        onmouseleave={handleLegendLeave}
        role="button"
        tabindex="0"
        onkeydown={(e) => e.key === 'Enter' && handleLegendHover(index)}
      >
        <span class="legend-color" style="background-color: {dataset.color}"></span>
        <span class="legend-label">{dataset.label}</span>
      </div>
    {/each}
  </div>
</div>

<style>
  .chart-container {
    display: flex;
    flex-direction: column;
    background: rgba(15, 23, 42, 0.6);
    border-radius: 8px;
    padding: 12px;
    border: 1px solid rgba(71, 85, 105, 0.5);
  }

  .chart-wrapper {
    flex: 1;
    min-height: 0;
    position: relative;
  }

  canvas {
    width: 100% !important;
    height: 100% !important;
  }

  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: center;
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid rgba(71, 85, 105, 0.3);
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s ease;
    background: rgba(30, 41, 59, 0.5);
  }

  .legend-item:hover,
  .legend-item.highlighted {
    background: rgba(59, 130, 246, 0.2);
  }

  .legend-item.dimmed {
    opacity: 0.4;
  }

  .legend-color {
    width: 12px;
    height: 12px;
    border-radius: 2px;
    flex-shrink: 0;
  }

  .legend-label {
    font-size: 0.75rem;
    color: #cbd5e1;
    white-space: nowrap;
  }
</style>

