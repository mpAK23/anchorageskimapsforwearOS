// Hillside Anchorage Coordinates
const START_LAT = 61.127;
const START_LNG = -149.77;
const START_ZOOM = 14;

// Initialize Map
const map = L.map('map', {
    zoomControl: false, // We hide default zoom for better watch UI
    attributionControl: false // Custom attribution in CSS
}).setView([START_LAT, START_LNG], START_ZOOM);

// Add Dark Mode Tiles (High Contrast & Battery Saving)
L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 19,
    subdomains: 'abcd',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
}).addTo(map);

// Add Attribution manually in a cleaner way if needed, or rely on the CSS one
L.control.attribution({
    prefix: false
}).addAttribution('Hillside Map').addTo(map);

// User Location Marker
const userIcon = L.divIcon({
    className: 'user-marker',
    html: '<div class="user-dot"></div>',
    iconSize: [20, 20],
    iconAnchor: [10, 10]
});

let userMarker = null;
let isFollowing = true;
let geoJsonLayer = null;

// Geolocation Handling
function onLocationFound(e) {
    const latlng = e.latlng;
    const radius = e.accuracy / 2;

    if (!userMarker) {
        userMarker = L.marker(latlng, { icon: userIcon }).addTo(map);
        // Add a circle for accuracy
        L.circle(latlng, {
            radius: radius,
            color: '#007AFF',
            fillColor: '#007AFF',
            fillOpacity: 0.1,
            weight: 1
        }).addTo(map);
    } else {
        userMarker.setLatLng(latlng);
    }

    if (isFollowing) {
        map.setView(latlng, map.getZoom());
    }
}

function onLocationError(e) {
    console.error("Location error:", e.message);
    // On watch, this might fail if permissions aren't granted
}

// Start watching position
map.locate({
    setView: false, // We manually handle view
    watch: true,
    enableHighAccuracy: true
});

map.on('locationfound', onLocationFound);
map.on('locationerror', onLocationError);

// Interaction Handling
map.on('dragstart', () => {
    isFollowing = false;
    document.getElementById('recenterBtn').style.opacity = '1';
});

document.getElementById('recenterBtn').addEventListener('click', () => {
    isFollowing = true;
    if (userMarker) {
        map.setView(userMarker.getLatLng(), 16);
    } else {
        // If no location yet, go back to start
        map.setView([START_LAT, START_LNG], START_ZOOM);
    }
});

// Load Trails Data
fetch('trails.geojson')
    .then(response => response.json())
    .then(data => {
        geoJsonLayer = L.geoJSON(data, {
            style: styleTrail,
            onEachFeature: onEachFeature
        }).addTo(map);
    })

    .catch(err => {
        console.error("Error loading trails:", err);
    });

function styleTrail(feature) {
    const difficulty = feature.properties.Difficulty_Level;
    let color = '#999'; // Default grey
    let dashArray = null;

    // Standard Ski Trail Colors
    if (difficulty === 'Novice' || difficulty === 'Easiest') {
        color = '#00ff00'; // Green
    } else if (difficulty === 'Intermediate' || difficulty === 'More Difficult') {
        color = '#007AFF'; // Blue
    } else if (difficulty === 'Advanced' || difficulty === 'Most Difficult') {
        color = '#000000'; // Black (will need white stroke on dark map?)
        // Actually for dark mode map, distinct colors are better.
        // Let's use: Green, Blue, Red (standard web map warnings) or keep standard ski colors?
        // Skiers expect Green/Blue/Black. On dark map, Black is invisible.
        // Let's use specific high-vis variations.
    }

    // Override for dark mode visibility
    switch (difficulty) {
        case 'Novice':
        case 'Easiest': 
            return { color: '#2ecc71', weight: 5 }; // Bright Green
        case 'Intermediate':
        case 'More Difficult': 
            return { color: '#3498db', weight: 5 }; // Bright Blue
        case 'Advanced':
        case 'Most Difficult': 
            return { color: '#e74c3c', weight: 5 }; // Bright Red/Orange (easier to see than black)
        default: 
            return { color: '#ecf0f1', weight: 3, dashArray: '5, 10' }; // White dashed for unknown
    }
}

let highlightedLayer = null;

function onEachFeature(feature, layer) {
    if (feature.properties) {
        const p = feature.properties;
        const popupContent = `
            <div style="color: #333; font-family: sans-serif;">
                <h3 style="margin: 0 0 5px 0;">${p.Grooming_Segment || 'Unknown Trail'}</h3>
                <div><strong>System:</strong> ${p.Grooming_System || 'N/A'}</div>
                <div><strong>Difficulty:</strong> ${p.Difficulty_Level || 'N/A'}</div>
                <div><strong>Lit:</strong> ${p.Lighted_Trail || 'No'}</div>
                <div><strong>Groomed:</strong> ${new Date(p.Grooming_Date).toLocaleDateString()}</div>
                <div><strong>Distance:</strong> ${p.Length_Miles} miles</div>
                <div><strong>Ski Only:</strong> ${p.Ski_Only || 'N/A'}</div>
            </div>
        `;
        layer.bindPopup(popupContent);

        layer.on('click', function (e) {
            // Reset previous highlight
            if (highlightedLayer) {
                geoJsonLayer.resetStyle(highlightedLayer);
            }

            // Highlight current
            layer.setStyle({
                weight: 8,
                color: '#ffff00', // Bright Yellow
                opacity: 1
            });

            highlightedLayer = layer;
            // Don't auto-pan/zoom if they are just exploring, or maybe do? 
            // User asked for "highlighted on the screen", keeping view is usually better.
        });
    }
}


