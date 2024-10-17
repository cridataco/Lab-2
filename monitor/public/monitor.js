const socket = io("http://localhost:8000"); // Ajusta al puerto correcto del servidor

const serverStatusContainer = document.getElementById('serverStatusContainer');
const charts = {};
const traceTables = {};
const logTables = {};

socket.on('connect', () => {
    console.log('Connected to WebSocket server');
});

socket.on('disconnect', () => {
    console.log('Disconnected from WebSocket server');
});

socket.on('updateServers', (servers) => {
    updateServerStatus(servers);
});

socket.on('logUpdate', (logs) => {
    updateServerLogs(logs);
});

function updateServerStatus(servers) {
    serverStatusContainer.innerHTML = '';

    servers.forEach(server => {
        const serverElement = document.createElement('div');
        serverElement.className = 'server-status';
        serverElement.innerHTML = `
            <h2>Server: ${server.server}</h2>
            <p>Status: <span class="${server.status === 'UP' ? 'status-up' : 'status-down'}">${server.status}</span></p>
            <p>Last Checked: ${new Date(server.timestamp).toLocaleTimeString()}</p>
            <canvas id="chart-${server.server.replace(/\W/g, '_')}" width="400" height="200"></canvas>
            <h3>Traceability</h3>
            <table class="table-trace" id="trace-${server.server.replace(/\W/g, '_')}">
                <thead>
                    <tr>
                        <th>Timestamp</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                </tbody>
            </table>
            <h3>Logs</h3>
            <table class="table-logs" id="logs-${server.server.replace(/\W/g, '_')}">
                <thead>
                    <tr>
                        <th>Time</th>
                        <th>Method</th>
                        <th>Path</th>
                        <th>Response</th>
                        <th>User Agent</th>
                    </tr>
                </thead>
                <tbody>
                </tbody>
            </table>
        `;
        serverStatusContainer.appendChild(serverElement);

        if (!charts[server.server]) {
            createHealthCheckChart(server.history || [], `chart-${server.server.replace(/\W/g, '_')}`, server.server);
        } else {
            updateHealthCheckChart(charts[server.server], server.history || []);
        }

        if (!traceTables[server.server]) {
            createTraceTable(server.history || [], `trace-${server.server.replace(/\W/g, '_')}`);
        } else {
            updateTraceTable(traceTables[server.server], server.history || []);
        }

        if (!logTables[server.server]) {
            createLogTable([], `logs-${server.server.replace(/\W/g, '_')}`);
        }
    });
}

function updateServerLogs(logs) {
    logs.forEach(log => {
        if (logTables[log.server]) {
            updateLogTable(logTables[log.server], log);
        }
    });
}

function createHealthCheckChart(data, canvasId, server) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    const chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.map(entry => new Date(entry.timestamp).toLocaleTimeString()),
            datasets: [{
                label: 'Health Status',
                data: data.map(entry => entry.status === 'UP' ? 1 : 0),
                fill: false,
                borderColor: 'rgb(75, 192, 192)',
                tension: 0.1
            }]
        },
        options: {
            scales: {
                y: {
                    beginAtZero: true,
                    max: 1,
                    ticks: {
                        callback: value => value === 1 ? 'UP' : 'DOWN'
                    }
                }
            }
        }
    });
    charts[server] = chart;
}

function updateHealthCheckChart(chart, data) {
    chart.data.labels = data.map(entry => new Date(entry.timestamp).toLocaleTimeString());
    chart.data.datasets[0].data = data.map(entry => entry.status === 'UP' ? 1 : 0);
    chart.update();
}

function createTraceTable(data, tableId) {
    const tableBody = document.getElementById(tableId).getElementsByTagName('tbody')[0];
    data.forEach(entry => {
        const row = tableBody.insertRow();
        const cellTimestamp = row.insertCell(0);
        const cellStatus = row.insertCell(1);

        cellTimestamp.textContent = new Date(entry.timestamp).toLocaleTimeString();
        cellStatus.textContent = entry.status;
    });
    traceTables[tableId] = tableBody;
}

function updateTraceTable(tableBody, data) {
    tableBody.innerHTML = '';
    data.forEach(entry => {
        const row = tableBody.insertRow();
        const cellTimestamp = row.insertCell(0);
        const cellStatus = row.insertCell(1);

        cellTimestamp.textContent = new Date(entry.timestamp).toLocaleTimeString();
        cellStatus.textContent = entry.status;
    });
}

function createLogTable(logs, tableId) {
    const tableBody = document.getElementById(tableId).getElementsByTagName('tbody')[0];
    logs.forEach(log => {
        const row = tableBody.insertRow();
        const cellTime = row.insertCell(0);
        const cellMethod = row.insertCell(1);
        const cellPath = row.insertCell(2);
        const cellResponse = row.insertCell(3);
        const cellUserAgent = row.insertCell(4);

        cellTime.textContent = log.time;
        cellMethod.textContent = log.method;
        cellPath.textContent = log.path;
        cellResponse.textContent = log.response;
        cellUserAgent.textContent = log.userAgent;
    });
    logTables[tableId] = tableBody;
}

function updateLogTable(tableBody, log) {
    const row = tableBody.insertRow();
    const cellTime = row.insertCell(0);
    const cellMethod = row.insertCell(1);
    const cellPath = row.insertCell(2);
    const cellResponse = row.insertCell(3);
    const cellUserAgent = row.insertCell(4);

    cellTime.textContent = log.time;
    cellMethod.textContent = log.method;
    cellPath.textContent = log.path;
    cellResponse.textContent = log.response;
    cellUserAgent.textContent = log.userAgent;
}
