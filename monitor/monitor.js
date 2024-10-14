document.addEventListener('DOMContentLoaded', function() {
    const refreshButton = document.getElementById('refreshButton');
    const serverData = document.getElementById('serverData');
    refreshButton.addEventListener('click', fetchServerData);

    function fetchServerData() {
        fetch('http://localhost:5001/monitor')
            .then(response => response.json())
            .then(data => {
                serverData.innerHTML = ''; 

                data.forEach(instance => {
                    const instanceDiv = document.createElement('div');
                    instanceDiv.classList.add('instance');

                    const instanceTitle = document.createElement('h2');
                    instanceTitle.textContent = `Instance: ${instance.server} - Status: ${instance.status}`;
                    instanceDiv.appendChild(instanceTitle);

                    const status = document.createElement('p');
                    status.textContent = `Last Checked: ${new Date(instance.timestamp).toLocaleTimeString()}`;
                    instanceDiv.appendChild(status);

                    const chartCanvas = document.createElement('canvas');
                    chartCanvas.id = `chart-${instance.server}`;
                    instanceDiv.appendChild(chartCanvas);

                    serverData.appendChild(instanceDiv);

                    createChart([instance], `chart-${instance.server}`);
                });
            })
            .catch(error => console.error('Error fetching instance data:', error));
    }

    function createChart(logs, chartId) {
        const canvas = document.getElementById(chartId);
        const ctx = canvas.getContext('2d');

        const labels = logs.map(log => new Date(log.timestamp).toLocaleTimeString());
        const statuses = logs.map(log => log.status === 'UP' ? 1 : 0);

        new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Server Health Status',
                    data: statuses,
                    borderColor: 'rgba(75, 192, 192, 1)',
                    fill: false,
                    borderWidth: 2
                }]
            },
            options: {
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return value === 1 ? 'UP' : 'DOWN';
                            }
                        }
                    }
                }
            }
        });
    }
});
