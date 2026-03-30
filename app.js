// Kincaid Park Coordinates (Approximate Center)
const START_LAT = 61.155;
const START_LNG = -150.045;
const START_ZOOM = 13;

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
    const p = feature.properties;
    const difficulty = p.Difficulty_Level;

    let color = '#ecf0f1'; // Default white
    let weight = 3;

    // Standard Ski Trail Colors mapping
    if (difficulty === 'Novice' || difficulty === 'Easiest') {
        color = '#2ecc71'; // Bright Green
        weight = 5;
    } else if (difficulty === 'Intermediate' || difficulty === 'More Difficult') {
        color = '#3498db'; // Bright Blue
        weight = 5;
    } else if (difficulty === 'Advanced' || difficulty === 'Most Difficult') {
        color = '#e74c3c'; // Bright Red/Orange (easier to see than black on dark map)
        weight = 5;
    }

    return { color: color, weight: weight };
}

let highlightedLayer = null;

function onEachFeature(feature, layer) {
    if (feature.properties) {
        const p = feature.properties;
        const name = p.Grooming_Segment || p.Grooming_System || 'Unknown Trail';

        const popupContent = `
            <div style="color: #333; font-family: sans-serif;">
                <h3 style="margin: 0 0 5px 0;">${name}</h3>
                <div><strong>System:</strong> ${p.Grooming_System || 'N/A'}</div>
                <div><strong>Difficulty:</strong> ${p.Difficulty_Level || 'N/A'}</div>
                <div><strong>Lit:</strong> ${p.Lighted_Trail || 'No'}</div>
                <div><strong>Distance:</strong> ${p.Length_Miles} miles</div>
                <div><strong>Ski Only:</strong> ${p.Ski_Only || 'N/A'}</div>
            </div>
        `;
        layer.bindPopup(popupContent);

        // --- Arrow Rendering Logic ---

        // 1. Exclude bidirectional trails
        const bidirectionalTrails = [
            "Tour of Anchorage",
            "Multi-Use",
            "Coastal Trail",
            "Chester Creek",
            "Campbell Creek Trail",
            "Connector",
            "GaslineTrail to Bivouac Lot",
            "Service High Connector Trail",
            "Bog"
        ];

        // 2. Identify trails that need REVERSING (User Feedback)
        const reverseTrails = [
            "Hillside Lighted Loop",
            "Jr. Nordic/ Service",
            "Richter Loop",
            "Sisson"
        ];

        const isBidirectional = bidirectionalTrails.some(k => name.includes(k));
        const isReversed = reverseTrails.some(k => name.includes(k));

        if (!isBidirectional) {

            let patterns = [
                {
                    offset: '20px',
                    repeat: '100px',
                    symbol: L.Symbol.arrowHead({
                        pixelSize: 15,
                        polygon: false,
                        pathOptions: { stroke: true, color: '#fff', weight: 4 }
                    })
                }
            ];

            let polylineForDecorator = layer;

            if (isReversed) {
                // To reverse the arrows, we need to pass coordinates in reverse order.
                let latlngs = layer.getLatLngs();

                // Helper to reverse latlngs structure (Handles MultiLineStrings)
                const reverseCoords = (coords) => {
                    if (Array.isArray(coords[0])) {
                        // Leaflet L.Polyline.getLatLngs() might return Array<LatLng> or Array<Array<LatLng>>
                        if (coords[0] instanceof L.LatLng) {
                            return [...coords].reverse();
                        } else {
                            // Struct is Array of Arrays (MultiLine)
                            return coords.map(c => [...c].reverse());
                        }
                    }
                    return coords;
                };

                // Pass reversed coordinates to a new polyline object (invisible) just for the decorator
                let revLatlngs = reverseCoords(latlngs);
                polylineForDecorator = L.polyline(revLatlngs);
            }

            const arrows = L.polylineDecorator(polylineForDecorator, {
                patterns: patterns
            }).addTo(map);
        }

        layer.on('click', function (e) {
            // Reset previous highlighting (not fully implemented for arrows, just lines)
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
        });
    }
}
