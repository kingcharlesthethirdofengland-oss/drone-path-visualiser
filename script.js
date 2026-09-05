let map = L.map('map', {
    zoomControl: false
}).setView([55.944, -3.187], 15);

map.options.zoomAnimation = false;
map.options.markerZoomAnimation = false;

L.control.zoom({
    position: 'bottomright'
}).addTo(map);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);


const droneIcon = L.icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/854/854894.png',
    iconSize: [32, 32],
    iconAnchor: [16, 16]
});

const deliveryIcon = L.icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/684/684908.png',
    iconSize: [26, 26],
    iconAnchor: [13, 13]
});


let droneMarker = null;
let trailLine = null;
let simulationInterval = null;
let currentCoords = [];
let index = -1;
let totalDistance = 0;
let deliveries = 0;
let lastLoadedJSON = null;


document.getElementById("fileInput").addEventListener("change", function(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = function(e) {
        try {
            const json = JSON.parse(e.target.result);
            lastLoadedJSON = json;
            handleGeoJSON(json);
        } catch (err) {
            alert("Invalid GeoJSON!");
        }
    };

    reader.readAsText(file);
});

function handleGeoJSON(json) {

    map.eachLayer(layer => {
        if (layer instanceof L.TileLayer) return;
        map.removeLayer(layer);
    });

    let coords = null;

    if (json.type === "FeatureCollection") {

        const lineFeature = json.features.find(
            f => f.geometry && f.geometry.type === "LineString"
        );
        if (!lineFeature) {
            alert("No LineString found.");
            return;
        }
        coords = lineFeature.geometry.coordinates;

        json.features
            .filter(f => f.geometry.type === "Polygon")
            .forEach(f => {
                const latLngs = f.geometry.coordinates.map(ring =>
                    ring.map(([lng, lat]) => [lat, lng])
                );

                L.polygon(latLngs, {
                    color: "orange",
                    weight: 2,
                    fillOpacity: 0.2
                })
                .addTo(map)
                .bindPopup(`<b>${f.properties?.name ?? "Area"}</b>`);
            });

    } else if (json.type === "LineString") {
        coords = json.coordinates;

    } else if (json.type === "Feature" && json.geometry.type === "LineString") {
        coords = json.geometry.coordinates;

    } else {
        alert("Not a valid LineString GeoJSON.");
        return;
    }

    currentCoords = coords.map(c => [c[1], c[0]]);

    totalDistance = 0;
    deliveries = 0;
    index = -1;
    trailLine = null;

    document.getElementById("distanceDisplay").innerText = `Distance: 0 m`;
    document.getElementById("deliveryDisplay").innerText = `Deliveries: 0`;

    startSimulation();
}

function startSimulation() {

    clearInterval(simulationInterval);

    if (droneMarker) map.removeLayer(droneMarker);

    droneMarker = L.marker(currentCoords[0], { icon: droneIcon }).addTo(map);

    simulationInterval = setInterval(simLoop, Number(document.getElementById("speedSlider").value));
}


function simLoop() {

    const speed = Number(document.getElementById("speedSlider").value);

    if (index >= currentCoords.length - 1) {
        clearInterval(simulationInterval);
        return;
    }

    index++;

    const curr = currentCoords[index];

    if (!trailLine) {
        trailLine = L.polyline([curr], {
            color: "#00aaff",
            weight: 4,
            opacity: 0.9
        }).addTo(map);
    } else {
        trailLine.addLatLng(curr);
    }

    if (index > 0) {
        const prev = currentCoords[index - 1];

        const mid = [
            (prev[0] + curr[0]) / 2,
            (prev[1] + curr[1]) / 2
        ];

        droneMarker.setLatLng(mid);

        setTimeout(() => {
            droneMarker.setLatLng(curr);
        }, speed / 2);

        const dist = haversine(prev, curr);
        totalDistance += dist;

        document.getElementById("distanceDisplay").innerText =
            `Distance: ${totalDistance.toFixed(1)} m`;

        if (prev[0] === curr[0] && prev[1] === curr[1]) {
            deliveries++;
            document.getElementById("deliveryDisplay").innerText =
                `Deliveries: ${deliveries}`;

            L.circleMarker(curr, {
                radius: 5,
                color: "#ffcc00",
                fillColor: "#ffcc00",
                fillOpacity: 1
            }).addTo(map);

            L.marker(curr, { icon: deliveryIcon }).addTo(map)
                .bindPopup("<b>Delivery Completed</b>")
                .openPopup();

            clearInterval(simulationInterval);
            setTimeout(() => {
                simulationInterval = setInterval(simLoop, speed);
            }, 700);
        }
    }
}

function haversine(a, b) {
    const R = 6371000;
    const toRad = d => d * Math.PI / 180;
    const dLat = toRad(b[0] - a[0]);
    const dLng = toRad(b[1] - a[1]);
    const lat1 = toRad(a[0]);
    const lat2 = toRad(b[0]);

    const h = Math.sin(dLat/2)**2 +
              Math.cos(lat1) * Math.cos(lat2) *
              Math.sin(dLng/2)**2;

    return 2 * R * Math.asin(Math.sqrt(h));
}


document.getElementById("pauseBtn").onclick = () =>
    clearInterval(simulationInterval);

document.getElementById("playBtn").onclick = () =>
    startSimulation();

document.getElementById("resetBtn").onclick = () => {
    trailLine = null;
    handleGeoJSON(lastLoadedJSON);
};
