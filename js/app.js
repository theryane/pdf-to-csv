// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// DOM Elements
const fileInput = document.getElementById('fileInput');
const processButton = document.getElementById('processButton');
const previewContainer = document.getElementById('previewContainer');
const preview = document.getElementById('preview');
const downloadBtn = document.getElementById('downloadBtn');

// Create processor instance
const processor = new PDFProcessor();

// Disable process button initially
processButton.disabled = true;

// File input handler
fileInput.addEventListener('change', function(e) {
    processButton.disabled = !e.target.files.length;
});

// Process button handler
processButton.addEventListener('click', async function() {
    const file = fileInput.files[0];
    if (!file) return;

    try {
        processButton.disabled = true;
        const arrayBuffer = await file.arrayBuffer();
        const result = await processor.processSchedule(arrayBuffer);
        
        // Display preview
        preview.textContent = result;
        previewContainer.classList.remove('hidden');
        
        processButton.disabled = false;
    } catch (error) {
        console.error('Error:', error);
        alert('Error processing PDF file');
        processButton.disabled = false;
    }
});

// Download button handler
downloadBtn.addEventListener('click', function() {
    const blob = new Blob([preview.textContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'schedule.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
});
