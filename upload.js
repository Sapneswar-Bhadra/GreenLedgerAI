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
        shipmentId: shipmentIdx !== -1 ? row[shipmentIdx] : 'SH-' + String(processedRows.length + 1).padStart(3, '0'),
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

  // ---- PDF report generation ----
  function getJsPDFConstructor() {
    if (window.jspdf && window.jspdf.jsPDF) {
      return window.jspdf.jsPDF;
    }
    if (typeof window.jsPDF === 'function') {
      return window.jsPDF;
    }
    return null;
  }

  function triggerPdfDownload(doc, filename) {
    // Primary: jsPDF built-in save (real PDF binary download)
    if (typeof doc.save === 'function') {
      doc.save(filename);
      return;
    }

    // Fallback: blob + anchor download
    var blob = doc.output('blob');
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function generatePDFReport(data) {
    var JsPDF = getJsPDFConstructor();
    if (!JsPDF) {
      throw new Error('PDF library not loaded.');
    }

    var doc = new JsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    if (typeof doc.autoTable !== 'function') {
      throw new Error('PDF table plugin not loaded.');
    }

    var pageWidth = doc.internal.pageSize.getWidth();
    var pageHeight = doc.internal.pageSize.getHeight();
    var margin = 20;

    // Header band
    doc.setFillColor(10, 31, 20);
    doc.rect(0, 0, pageWidth, 36, 'F');

    // Logo mark
    doc.setFillColor(34, 197, 94);
    doc.roundedRect(margin, 10, 14, 14, 2, 2, 'F');
    doc.setFillColor(10, 31, 20);
    doc.triangle(margin + 3, 21, margin + 7, 13, margin + 11, 21, 'F');
    doc.setFillColor(74, 222, 128);
    doc.circle(margin + 7, 22.5, 1.2, 'F');

    // Title
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text('Green Ledger AI', margin + 18, 17);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(134, 239, 172);
    doc.text('Carbon Emissions Report', margin + 18, 24);

    // Report date
    var reportDate = new Date().toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    var startY = 48;
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text('Report Date: ' + reportDate, margin, startY);

    // Summary section
    startY += 12;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(10, 31, 20);
    doc.text('Executive Summary', margin, startY);

    startY += 8;
    var cardWidth = (pageWidth - margin * 2 - 10) / 3;
    var cardHeight = 22;
    var summaries = [
      { label: 'Total Shipments', value: formatNumber(data.totalShipments, 0) },
      { label: 'Total Distance', value: formatNumber(data.totalDistance, 1) + ' km' },
      { label: 'Total CO2 Emissions', value: formatNumber(data.totalCo2, 1) + ' kg CO2e' }
    ];

    summaries.forEach(function (item, i) {
      var x = margin + i * (cardWidth + 5);
      doc.setFillColor(240, 253, 244);
      doc.setDrawColor(34, 197, 94);
      doc.roundedRect(x, startY, cardWidth, cardHeight, 2, 2, 'FD');

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(item.label, x + 4, startY + 8);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(10, 31, 20);
      if (i === 2) {
        doc.setTextColor(22, 163, 74);
      }
      doc.text(item.value, x + 4, startY + 17);
    });

    // Shipment table
    var tableBody = data.rows.map(function (row) {
      return [
        row.shipmentId,
        formatNumber(row.distanceKm, 1),
        row.vehicleType,
        formatNumber(row.co2, 2)
      ];
    });

    doc.autoTable({
      startY: startY + cardHeight + 14,
      margin: { left: margin, right: margin },
      head: [['Shipment ID', 'Distance (km)', 'Vehicle Type', 'CO2 (kg)']],
      body: tableBody,
      theme: 'grid',
      headStyles: {
        fillColor: [10, 31, 20],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 9,
        cellPadding: 4
      },
      bodyStyles: {
        fontSize: 9,
        textColor: [30, 41, 59],
        cellPadding: 3.5
      },
      alternateRowStyles: {
        fillColor: [240, 253, 244]
      },
      columnStyles: {
        0: { cellWidth: 40 },
        1: { halign: 'right' },
        2: { cellWidth: 35 },
        3: { halign: 'right', fontStyle: 'bold', textColor: [22, 163, 74] }
      },
      didDrawPage: function () {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(
          'Generated by Green Ledger AI',
          pageWidth / 2,
          pageHeight - 10,
          { align: 'center' }
        );
      }
    });

    triggerPdfDownload(doc, 'GreenLedger_Report.pdf');
  }

  downloadReportBtn.addEventListener('click', function () {
    if (!currentReport) return;

    var originalText = downloadReportBtn.textContent;
    downloadReportBtn.disabled = true;
    downloadReportBtn.textContent = 'Generating PDF…';

    try {
      generatePDFReport(currentReport);
    } catch (err) {
      alert('Could not generate PDF: ' + err.message + '\n\nMake sure you are online so jsPDF can load, then refresh and try again.');
    } finally {
      downloadReportBtn.disabled = false;
      downloadReportBtn.textContent = originalText;
    }
  });
})();
