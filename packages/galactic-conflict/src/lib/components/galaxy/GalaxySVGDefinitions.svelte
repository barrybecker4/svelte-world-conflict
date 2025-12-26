<script lang="ts">
    // No props needed - this component just defines reusable SVG elements
</script>

<!-- Definitions -->
<defs>
    <!-- Planet gradient for 3D effect -->
    <radialGradient id="planet-gradient" cx="30%" cy="30%" r="70%">
        <stop offset="0%" stop-color="white" />
        <stop offset="100%" stop-color="transparent" />
    </radialGradient>

    <!-- Star field pattern -->
    <pattern id="stars" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
        <circle cx="10" cy="10" r="0.5" fill="white" opacity="0.5" />
        <circle cx="50" cy="30" r="0.3" fill="white" opacity="0.3" />
        <circle cx="80" cy="60" r="0.4" fill="white" opacity="0.4" />
        <circle cx="30" cy="80" r="0.3" fill="white" opacity="0.3" />
        <circle cx="70" cy="90" r="0.5" fill="white" opacity="0.5" />
        <circle cx="90" cy="20" r="0.3" fill="white" opacity="0.4" />
        <circle cx="20" cy="50" r="0.4" fill="white" opacity="0.3" />
    </pattern>

    <!-- Glow filter -->
    <filter id="glow">
        <feGaussianBlur stdDeviation="2" result="coloredBlur" />
        <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
        </feMerge>
    </filter>
</defs>

<!-- Background -->
<rect width="100%" height="100%" fill="#0a0a14" />
<rect width="100%" height="100%" fill="url(#stars)" />
