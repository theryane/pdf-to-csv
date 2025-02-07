class PDFProcessor {
    constructor() {
        console.log('PDFProcessor initialized');
    }

    async processSchedule(pdfData) {
        try {
            const pdf = await pdfjsLib.getDocument(pdfData).promise;
            const activities = [];
            
            // Process each page
            for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                const page = await pdf.getPage(pageNum);
                const textContent = await page.getTextContent();
                const pageActivities = this.processPageContent(textContent.items);
                activities.push(...pageActivities);
            }

            return this.formatOutput(activities);
        } catch (error) {
            console.error('Error:', error);
            throw error;
        }
    }

    processPageContent(items) {
        const activities = [];
        let currentLine = [];
        let lastY = null;

        // Sort items by vertical position (top to bottom)
        items.sort((a, b) => b.transform[5] - a.transform[5]);

        // Group items into lines
        for (const item of items) {
            const y = Math.round(item.transform[5]);
            
            if (lastY !== null && Math.abs(y - lastY) > 2) {
                if (currentLine.length > 0) {
                    const activity = this.processLine(currentLine);
                    if (activity) {
                        activities.push(activity);
                    }
                    currentLine = [];
                }
            }
            
            currentLine.push(item);
            lastY = y;
        }

        return activities;
    }

    processLine(items) {
        // Sort items by horizontal position
        items.sort((a, b) => a.transform[4] - b.transform[4]);
        
        const text = items.map(item => item.str).join(' ');
        
        // Skip header and non-activity lines
        if (this.shouldSkip(text)) {
            return null;
        }

        // Check for activity ID pattern
        const idMatch = items.find(item => /^(MILE-|P1MILE-|LOE-|SUMM-)/.test(item.str));
        if (!idMatch) {
            return null;
        }

        // Extract activity details
        return {
            activityId: idMatch.str,
            activityName: this.extractActivityName(items, idMatch),
            originalDuration: this.extractDuration(items),
            remainingDuration: this.extractDuration(items, true),
            startDate: this.extractDate(items),
            finishDate: this.extractDate(items, true)
        };
    }

    shouldSkip(text) {
        return text.includes('Activity ID') ||
               text.includes('Duration') ||
               text.includes('PAGE') ||
               text.includes('Full WBS') ||
               text.includes('WALTER REED') ||
               text.includes('Total');
    }

    extractActivityName(items, idItem) {
        const startIndex = items.indexOf(idItem) + 1;
        let name = [];
        
        for (let i = startIndex; i < items.length; i++) {
            const text = items[i].str;
            if (/^\d+$/.test(text) || this.isDate(text)) {
                break;
            }
            name.push(text);
        }
        
        return name.join(' ');
    }

    extractDuration(items, isRemaining = false) {
        const durations = items.filter(item => /^\d+$/.test(item.str));
        return durations[isRemaining ? 1 : 0]?.str || '0';
    }

    extractDate(items, isFinish = false) {
        const dates = items.filter(item => this.isDate(item.str));
        const date = dates[isFinish ? 1 : 0]?.str || '';
        return date.replace(/[*A]$/, '');
    }

    isDate(text) {
        return /\d{2}-[A-Za-z]{3}-\d{2}/.test(text);
    }

    formatOutput(activities) {
        const header = 'Activity ID,Activity Name,Original Duration,Remaining Duration,Start Date,Finish Date';
        
        const rows = activities.map(activity => {
            return [
                activity.activityId,
                `"${activity.activityName}"`,
                activity.originalDuration,
                activity.remainingDuration,
                activity.startDate,
                activity.finishDate
            ].join(',');
        });

        return header + '\n\n' + rows.join('\n');
    }
}

window.PDFProcessor = PDFProcessor;
