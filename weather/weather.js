function getPressureTrend(current, history) {
  if (current == null || !Array.isArray(history) || history.length < 2) {
    return "⚪";
  }

  const pressureReadings = history
    .filter(r => r.pressure_hpa != null)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  if (pressureReadings.length < 2) return "⚪";

  const latest = pressureReadings[pressureReadings.length - 1];
  const latestTime = new Date(latest.timestamp);

  const sixHoursAgo = new Date(latestTime.getTime() - 6 * 60 * 60 * 1000);

  let comparison = pressureReadings[0];

  for (const reading of pressureReadings) {
    const readingTime = new Date(reading.timestamp);
    if (readingTime <= sixHoursAgo) {
      comparison = reading;
    } else {
      break;
    }
  }

  const delta = current - comparison.pressure_hpa;

  if (delta >= 1.5) return "⬆️"; // Rising
  if (delta <= -1.5) return "⬇️"; // Falling

  return "🟢"; // Steady
}

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

  if (current >= excellent) return "🟢🟢";
  if (current >= good) return "🟢";
  if (current <= high) return "🔴";
  if (current <= elevated) return "🟠";

  return "🟡";
}

function getSoilStatus(percent) {
  if (percent == null) return "Unknown";

  if (percent >= 90) return "💧";
  if (percent >= 70) return "🟢";
  if (percent >= 50) return "🟡";
  if (percent >= 30) return "🟠";

  return "🔴";
}

function getBatteryStatus(percent) {
  if (percent == null) return "Unknown";

  if (percent >= 80) return "Excellent";
  if (percent >= 60) return "Good";
  if (percent >= 40) return "Fair";
  if (percent >= 20) return "Low";

  return "Recharge";
}

function formatLastUpdated(timestamp) {
  if (!timestamp) return "Unknown";

  const updated = new Date(timestamp);
  const now = new Date();

  const diffMinutes = Math.floor((now - updated) / 60000);

  if (diffMinutes < 1) return "🟢 Just now";
  if (diffMinutes < 60) return `🟢 ${diffMinutes} min ago`;

  const diffHours = Math.floor(diffMinutes / 60);

  if (diffHours < 24) return `🟡 ${diffHours} hr ago`;

  const diffDays = Math.floor(diffHours / 24);

  return `🔴 ${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
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

  document.getElementById("pressure").innerHTML =
    data.pressure_hpa != null
      ? `${getPressureTrend(data.pressure_hpa, history30)} ${data.pressure_hpa.toFixed(0)}`
      : "--";

  document.getElementById("gas").innerHTML =
    `${getVOCStatus(data.gas_kohms, history30)} ${data.gas_kohms.toFixed(1)}`;

  document.getElementById("soil").innerHTML =
    data.soil_percent != null
      ? `${getSoilStatus(data.soil_percent)} ${data.soil_percent}%`
      : "⚪ N/A";

  document.getElementById("battery").textContent =
    `${data.battery_percent ?? "--"}%`;

  document.getElementById("lastUpdated").textContent =
    formatLastUpdated(data.last_update);
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
