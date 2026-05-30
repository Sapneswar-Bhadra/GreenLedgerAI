/**
 * Green Ledger AI — Upload Demo
 * Reads CSV in browser and estimates CO₂ emissions from logistics data.
 */

(function () {
  'use strict';

  // Emission factors: kg CO₂e per km (simplified DEFRA-style averages)
  var EMISSION_FACTORS = {
    hgv: 0.89,
    truck: 0.89,
    lorry: 0.89,
    articulated: 0.89,
    van: 0.31,
    rail: 0.03,
    ship: 0.015,
    sea: 0.015,
    default: 0.62
  };

  var header = document.getElementById('header');
  var navToggle = document.getElementById('navToggle');
  var navLinks = document.getElementById('navLinks');
  var uploadZone = document.getElementById('uploadZone');
  var csvInput = document.getElementById('csvInput');
  var browseBtn = document.getElementById('browseBtn');
  var uploadError = document.getElementById('uploadError');
  var uploadSection = document.getElementById('uploadSection');
  var resultsPanel = document.getElementById('resultsPanel');
  var totalDistanceEl = document.getElementById('totalDistance');
  var totalShipmentsEl = document.getElementById('totalShipments');
  var totalCo2El = document.getElementById('totalCo2');
  var tableHead = document.getElementById('tableHead');
  var tableBody = document.getElementById('tableBody');
  var uploadAnotherBtn = document.getElementById('uploadAnotherBtn');
  var downloadReportBtn = document.getElementById('downloadReportBtn');

  var currentReport = null;

  // ---- Header scroll ----
  function handleScroll() {
    header.classList.toggle('scrolled', window.scrollY > 20);
  }

  window.addEventListener('scroll', handleScroll, { passive: true });
  handleScroll();

  // ---- Mobile nav ----
  navToggle.addEventListener('click', function () {
    var isOpen = navLinks.classList.toggle('open');
    navToggle.classList.toggle('active', isOpen);
    navToggle.setAttribute('aria-expanded', isOpen);
  });

  navLinks.querySelectorAll('a').forEach(function (link) {
    link.addEventListener('click', function () {
      navLinks.classList.remove('open');
      navToggle.classList.remove('active');
      navToggle.setAttribute('aria-expanded', 'false');
    });
  });

  // ---- CSV parsing ----
  function parseCSV(text) {
    var rows = [];
    var current = '';
    var inQuotes = false;
    var row = [];

    for (var i = 0; i < text.length; i++) {
      var char = text[i];
      var next = text[i + 1];

      if (char === '"') {
        if (inQuotes && next === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        row.push(current.trim());
        current = '';
      } else if ((char === '\n' || char === '\r') && !inQuotes) {
        if (char === '\r' && next === '\n') i++;
        row.push(current.trim());
        current = '';
        if (row.some(function (cell) { return cell.length > 0; })) {
          rows.push(row);
        }
        row = [];
      } else {
        current += char;
      }
    }

    if (current.length > 0 || row.length > 0) {
      row.push(current.trim());
      if (row.some(function (cell) { return cell.length > 0; })) {
        rows.push(row);
      }
    }

    return rows;
  }

  function normalizeHeader(name) {
    return name.toLowerCase().replace(/[\s_-]+/g, '_').trim();
  }

  function findColumnIndex(headers, aliases) {
    var normalized = headers.map(normalizeHeader);
    for (var i = 0; i < aliases.length; i++) {
      var idx = normalized.indexOf(aliases[i]);
      if (idx !== -1) return idx;
    }
    return -1;
  }

  function getEmissionFactor(vehicleType) {
    if (!vehicleType) return EMISSION_FACTORS.default;
    var key = vehicleType.toLowerCase().trim();
    return EMISSION_FACTORS[key] !== undefined ? EMISSION_FACTORS[key] : EMISSION_FACTORS.default;
  }

  function parseDistance(value) {
    var num = parseFloat(String(value).replace(/,/g, ''));
    return isNaN(num) ? 0 : num;
  }

  function formatNumber(num, decimals) {
    return num.toLocaleString('en-GB', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  }

  function processCSV(text) {
    var rows = parseCSV(text);
    if (rows.length < 2) {
      throw new Error('CSV must include a header row and at least one data row.');
    }

    var headers = rows[0];
    var distanceIdx = findColumnIndex(headers, ['distance_km', 'distance', 'km', 'miles', 'mileage']);
    var vehicleIdx = findColumnIndex(headers, ['vehicle_type', 'vehicle', 'type', 'mode']);
    var shipmentIdx = findColumnIndex(headers, ['shipment_id', 'shipment', 'id', 'reference', 'ref']);

    if (distanceIdx === -1) {
      throw new Error('Could not find a distance column. Use distance_km, distance, or km.');
    }

    var isMiles = findColumnIndex(headers, ['miles']) === distanceIdx;
    var processedRows = [];
    var totalDistance = 0;
    var totalCo2 = 0;

    for (var r = 1; r < rows.length; r++) {
      var row = rows[r];
      if (row.length === 0 || row.every(function (c) { return !c; })) continue;

      var rawDistance = parseDistance(row[distanceIdx]);
      var distanceKm = isMiles ? rawDistance * 1.60934 : rawDistance;
      var vehicleType = vehicleIdx !== -1 ? row[vehicleIdx] : '';
      var factor = getEmissionFactor(vehicleType);
      var co2 = distanceKm * factor;

      totalDistance += distanceKm;
      totalCo2 += co2;

      processedRows.push({
        original: row,
        distanceKm: distanceKm,
        vehicleType: vehicleType || 'default',
        emissionFactor: factor,
        co2: co2
      });
    }

    if (processedRows.length === 0) {
      throw new Error('No valid shipment rows found in the CSV.');
    }

    return {
      headers: headers,
      rows: processedRows,
      totalDistance: totalDistance,
      totalShipments: processedRows.length,
      totalCo2: totalCo2,
      distanceIdx: distanceIdx,
      vehicleIdx: vehicleIdx,
      shipmentIdx: shipmentIdx
    };
  }

  function renderResults(data) {
    currentReport = data;

    totalDistanceEl.textContent = formatNumber(data.totalDistance, 1);
    totalShipmentsEl.textContent = formatNumber(data.totalShipments, 0);
    totalCo2El.textContent = formatNumber(data.totalCo2, 1);

    var displayHeaders = data.headers.slice();
    displayHeaders.push('CO₂ (kg)');

    var headRow = document.createElement('tr');
    displayHeaders.forEach(function (h) {
      var th = document.createElement('th');
      th.textContent = h;
      headRow.appendChild(th);
    });
    tableHead.innerHTML = '';
    tableHead.appendChild(headRow);

    tableBody.innerHTML = '';
    data.rows.forEach(function (item) {
      var tr = document.createElement('tr');
      item.original.forEach(function (cell) {
        var td = document.createElement('td');
        td.textContent = cell;
        tr.appendChild(td);
      });
      var co2Td = document.createElement('td');
      co2Td.textContent = formatNumber(item.co2, 2);
      co2Td.className = 'co2-cell';
      tr.appendChild(co2Td);
      tableBody.appendChild(tr);
    });

    uploadSection.hidden = true;
    resultsPanel.hidden = false;
    uploadError.hidden = true;
  }

  function showError(message) {
    uploadError.textContent = message;
    uploadError.hidden = false;
  }

  function handleFile(file) {
    uploadError.hidden = true;

    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.csv') && file.type !== 'text/csv') {
      showError('Please upload a CSV file.');
      return;
    }

    var reader = new FileReader();
    reader.onload = function (e) {
      try {
        var data = processCSV(e.target.result);
        renderResults(data);
      } catch (err) {
        showError(err.message);
      }
    };
    reader.onerror = function () {
      showError('Failed to read the file. Please try again.');
    };
    reader.readAsText(file);
  }

  // ---- Upload interactions ----
  browseBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    csvInput.click();
  });

  uploadZone.addEventListener('click', function () {
    csvInput.click();
  });

  csvInput.addEventListener('change', function () {
    handleFile(csvInput.files[0]);
    csvInput.value = '';
  });

  uploadZone.addEventListener('dragover', function (e) {
    e.preventDefault();
    uploadZone.classList.add('dragover');
  });

  uploadZone.addEventListener('dragleave', function () {
    uploadZone.classList.remove('dragover');
  });

  uploadZone.addEventListener('drop', function (e) {
    e.preventDefault();
    uploadZone.classList.remove('dragover');
    var file = e.dataTransfer.files[0];
    handleFile(file);
  });

  uploadAnotherBtn.addEventListener('click', function () {
    currentReport = null;
    resultsPanel.hidden = true;
    uploadSection.hidden = false;
    tableHead.innerHTML = '';
    tableBody.innerHTML = '';
  });

  // ---- Download report (placeholder: generates a simple text summary) ----
  downloadReportBtn.addEventListener('click', function () {
    if (!currentReport) return;

    var lines = [
      'GREEN LEDGER AI — EMISSIONS REPORT (DEMO)',
      'Generated: ' + new Date().toISOString(),
      '',
      'SUMMARY',
      '-------',
      'Total Distance: ' + formatNumber(currentReport.totalDistance, 1) + ' km',
      'Total Shipments: ' + formatNumber(currentReport.totalShipments, 0),
      'Estimated CO₂ Emissions: ' + formatNumber(currentReport.totalCo2, 1) + ' kg CO₂e',
      '',
      'METHODOLOGY',
      '-----------',
      'Emission factors (kg CO₂e/km): HGV 0.89 | Van 0.31 | Rail 0.03 | Default 0.62',
      '',
      'SHIPMENT DETAIL',
      '---------------'
    ];

    currentReport.rows.forEach(function (row, i) {
      lines.push(
        'Row ' + (i + 1) + ': ' + formatNumber(row.distanceKm, 1) + ' km × ' +
        row.emissionFactor + ' = ' + formatNumber(row.co2, 2) + ' kg CO₂e'
      );
    });

    lines.push('', '— End of report —', 'Full PDF reports coming soon.');

    var blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'green-ledger-emissions-report.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
})();
