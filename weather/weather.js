async function loadCurrent() {
  const response = await fetch("current.json");
  const data = await response.json();

  document.getElementById("temp").textContent =
    `${data.temperature_f?.toFixed(1) ?? "--"}°F`;

  document.getElementById("humidity").textContent =
    `${data.humidity?.toFixed(1) ?? "--"}%`;

  document.getElementById("pressure").textContent =
    `${data.pressure_hpa?.toFixed(1) ?? "--"} hPa`;

  document.getElementById("gas").textContent =
    `${data.gas_kohms?.toFixed(1) ?? "--"} kΩ`;

  document.getElementById("soil").textContent =
    data.soil_percent != null
      ? `${data.soil_percent}%`
      : data.soil_status || "N/A";

  document.getElementById("battery").textContent =
    `${data.battery_percent ?? "--"}%`;

  document.getElementById("lastUpdated").textContent =
    `Last updated: ${data.last_update}`;
}

function makeChart(canvasId, label, values, labels) {
  new Chart(document.getElementById(canvasId), {
    type: "line",
    data: {
      labels: labels,
      datasets: [{
        label: label,
        data: values,
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false
    }
  });
}

let tempChart;
let humidityChart;
let pressureChart;
let batteryChart;

function createOrUpdateChart(existingChart, canvasId, label, values, labels) {
  if (existingChart) {
    existingChart.destroy();
  }

  return new Chart(document.getElementById(canvasId), {
    type: "line",
    data: {
      labels: labels,
      datasets: [{
        label: label,
        data: values,
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false
    }
  });
}

async function loadHistory(range = "24h") {
  const response = await fetch(`history_${range}.json`);
  const history = await response.json();

  const labels = history.map(r => {
    const d = new Date(r.timestamp);

    if (range === "24h") {
      return d.toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit"
      });
    }

    return d.toLocaleDateString([], {
      month: "short",
      day: "numeric"
    });
  });

  tempChart = createOrUpdateChart(
    tempChart,
    "tempChart",
    "Temperature (°F)",
    history.map(r => r.temperature_f),
    labels
  );

  humidityChart = createOrUpdateChart(
    humidityChart,
    "humidityChart",
    "Humidity (%)",
    history.map(r => r.humidity),
    labels
  );

  pressureChart = createOrUpdateChart(
    pressureChart,
    "pressureChart",
    "Pressure (hPa)",
    history.map(r => r.pressure_hpa),
    labels
  );

  batteryChart = createOrUpdateChart(
    batteryChart,
    "batteryChart",
    "Battery (%)",
    history.map(r => r.battery_percent),
    labels
  );
}

loadCurrent();
loadHistory("24h");

document.querySelectorAll(".range-buttons button").forEach(button => {
  button.addEventListener("click", () => {
    document
      .querySelectorAll(".range-buttons button")
      .forEach(b => b.classList.remove("active"));

    button.classList.add("active");

    loadHistory(button.dataset.range);
  });
});
