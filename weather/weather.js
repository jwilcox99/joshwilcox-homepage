function getVOCStatus(current, history) {
  if (current == null || !Array.isArray(history) || history.length < 10) {
    return "VOC Normal";
  }

  const values = history
    .map(r => r.gas_kohms)
    .filter(v => v != null && !Number.isNaN(v));

  if (values.length < 10) return "VOC Normal";

  const avg = values.reduce((sum, v) => sum + v, 0) / values.length;

  const excellent = avg * 1.20;
  const good = avg * 1.10;
  const elevated = avg * 0.90;
  const high = avg * 0.80;

  if (current >= excellent) return "🟢🟢🟢";
  if (current >= good) return "🟢";
  if (current <= high) return "🔴";
  if (current <= elevated) return "🟠";

  return "🟡";
}

function getSoilStatus(percent) {
  if (percent == null) return "Unknown";

  if (percent >= 90) return "💧 Wet";
  if (percent >= 70) return "🟢 Moist";
  if (percent >= 50) return "🟡 Drying";
  if (percent >= 30) return "🟠 Dry";

  return "🔴 Water Needed";
}

function getBatteryStatus(percent) {
  if (percent == null) return "Unknown";

  if (percent >= 80) return "Excellent";
  if (percent >= 60) return "Good";
  if (percent >= 40) return "Fair";
  if (percent >= 20) return "Low";

  return "Recharge";
}
async function loadCurrent() {
  const response = await fetch("current.json");
  const data = await response.json();

    let history30 = [];
  try {
    const historyResponse = await fetch("history_30d.json");
    history30 = await historyResponse.json();
  } catch (error) {
    console.warn("Could not load VOC baseline history", error);
  }

  document.getElementById("temp").textContent =
    `${data.temperature_f?.toFixed(1) ?? "--"}°F`;

  document.getElementById("humidity").textContent =
    `${data.humidity?.toFixed(1) ?? "--"}%`;

  document.getElementById("pressure").textContent =
    `${data.pressure_hpa?.toFixed(1) ?? "--"} hPa`;

  document.getElementById("gas").innerHTML =
  data.gas_kohms != null `
    ?${getVOCStatus(data.gas_kohms, history30)}<br><small>${data.gas_kohms.toFixed(1)} kΩ</small>`
    : "--";

  document.getElementById("soil").textContent =
    data.soil_percent != null
      ? `${data.soil_percent}%`
      : data.soil_status || "N/A";

  document.getElementById("battery").textContent =
    `${data.battery_percent ?? "--"}%`;

  document.getElementById("lastUpdated").textContent =
    `Last updated: ${data.last_update}`;
}

async function loadTodaySummary() {
  const response = await fetch("summary_today.json");
  
  if (!response.ok) {
    console.warn("summary_today.json not found yet");
    return;
  }
  const data = await response.json();

  const trendIcon =
    data.temp_trend === "Rising" ? "⬆️ " :
    data.temp_trend === "Falling" ? "⬇️ " :
    "➡️ ";

  document.getElementById("todayTrend").textContent =
    data.temp_trend ? `${trendIcon}${data.temp_trend}` : "--";

  document.getElementById("todayHigh").textContent =
    data.temp_high_f != null ? `${data.temp_high_f.toFixed(1)}°F` : "--";

  document.getElementById("todayLow").textContent =
    data.temp_low_f != null ? `${data.temp_low_f.toFixed(1)}°F` : "--";

  document.getElementById("todayAvg").textContent =
    data.temp_avg_f != null ? `${data.temp_avg_f.toFixed(1)}°F` : "--";

  document.getElementById("todaySwing").textContent =
    data.temp_swing_f != null ? `${data.temp_swing_f.toFixed(1)}°F` : "--";

  document.getElementById("todayReadings").textContent =
    data.reading_count ?? "--";
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
loadTodaySummary();
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
