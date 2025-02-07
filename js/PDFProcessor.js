class PDFProcessor {
    constructor() {
        console.log('PDFProcessor initialized');
        // Column ranges are critical for parsing
        this.columnRanges = {
            activityId: { start: 0, end: 100 },
            activityName: { start: 100, end: 350 },
            originalDuration: { start: 350, end: 450 },
            remainingDuration: { start: 450, end: 500 },
            startDate: { start: 500, end: 600 },
            finishDate: { start: 600, end: 700 }
        };
    }

    async processSchedule(pdfData) {
        try {
            console.log('Processing schedule...');
            const pdf = await pdfjsLib.getDocument(pdfData).promise;
            console.log('Number of pages:', pdf.numPages);
            const scheduleData = await this.extractScheduleData(pdf);
            return this.formatScheduleData(scheduleData);
        } catch (error) {
            console.error('Error processing schedule:', error);
            throw error;
        }
    }

    async extractScheduleData(pdf) {
        const activities = [];
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            console.log('Processing page', pageNum);
            const page = await pdf.getPage(pageNum);
            const textContent = await page.getTextContent();
            console.log('Items on page:', textContent.items.length);
            
            // Group items by vertical position (y-coordinate)
            const lines = this.groupItemsByLine(textContent.items);
            console.log('Lines grouped:', lines.length);
            
            for (const line of lines) {
                const activity = this.processLine(line);
                if (activity) {
                    activities.push(activity);
                }
            }
        }
        console.log('Total activities found:', activities.length);
        return activities;
    }

    groupItemsByLine(items) {
        // Sort items by vertical position
        items.sort((a, b) => b.transform[5] - a.transform[5]);
        
        const lines = [];
        let currentLine = [];
        let currentY = null;

        for (const item of items) {
            const y = Math.round(item.transform[5]);
            if (currentY === null) {
                currentY = y;
            }

            if (Math.abs(y - currentY) > 2) { // Threshold for new line
                if (currentLine.length > 0) {
                    lines.push([...currentLine].sort((a, b) => a.transform[4] - b.transform[4]));
                }
                currentLine = [];
                currentY = y;
            }
            currentLine.push(item);
        }

        if (currentLine.length > 0) {
            lines.push([...currentLine].sort((a, b) => a.transform[4] - b.transform[4]));
        }

        return lines;
    }

    processLine(items) {
        // Skip headers and empty lines
        const lineText = items.map(item => item.str).join(' ');
        if (this.shouldSkipLine(lineText)) {
            return null;
        }

        // Check for activity ID pattern
        const activityIdMatch = items.find(item => 
            /^(MILE-|P1MILE-|LOE-|SUMM-)/.test(item.str)
        );

        if (!activityIdMatch) {
            return null;
        }

        const activity = {
            activityId: '',
            activityName: '',
            originalDuration: '',
            remainingDuration: '',
            startDate: '',
            finishDate: ''
        };

        let currentField = null;
        let lastX = 0;

        for (const item of items) {
            const x = item.transform[4];
            const text = item.str.trim();

            if (this.isActivityId(text)) {
                activity.activityId = text;
                currentField = 'activityName';
                lastX = x;
                continue;
            }

            // Determine which field this item belongs to based on x position
            const field = this.determineField(x);
            if (field && field !== currentField) {
                currentField = field;
            }

            if (currentField) {
                if (this.isDate(text)) {
                    if (!activity.startDate) {
                        activity.startDate = this.cleanDate(text);
                    } else {
                        activity.finishDate = this.cleanDate(text);
                    }
                } else if (currentField === 'activityName' && !this.isNumber(text)) {
                    activity.activityName += (activity.activityName ? ' ' : '') + text;
                } else if (this.isNumber(text)) {
                    if (!activity.originalDuration) {
                        activity.originalDuration = text;
                    } else if (!activity.remainingDuration) {
                        activity.remainingDuration = text;
                    }
                }
            }
        }

        return this.validateActivity(activity) ? activity : null;
    }

    determineField(x) {
        for (const [field, range] of Object.entries(this.columnRanges)) {
            if (x >= range.start && x < range.end) {
                return field;
            }
        }
        return null;
    }

    shouldSkipLine(text) {
        return text.includes('Activity ID') ||
               text.includes('Duration') ||
               text.includes('PAGE') ||
               text.includes('Full WBS') ||
               text.includes('WALTER REED') ||
               text.length < 2;
    }

    isActivityId(text) {
        return /^(MILE-|P1MILE-|LOE-|SUMM-)/.test(text);
    }

    isDate(text) {
        return /\d{2}-[A-Za-z]{3}-\d{2}/.test(text);
    }

    isNumber(text) {
        return /^\d+$/.test(text);
    }

    cleanDate(date) {
        return date.replace(/[*A]$/, '').trim();
    }

    validateActivity(activity) {
        return activity.activityId && 
               activity.activityId.length > 0 && 
               !activity.activityId.includes('Total');
    }

    formatScheduleData(activities) {
        const header = 'Activity ID,Activity Name,Original Duration,Remaining Duration,Start Date,Finish Date';
        if (activities.length === 0) {
            console.log('No activities found to format');
            return header;
        }

        const rows = activities.map(activity => {
            return [
                activity.activityId,
                `"${activity.activityName.trim()}"`,
                activity.originalDuration,
                activity.remainingDuration,
                activity.startDate,
                activity.finishDate
            ].join(',');
        });

        return header + '\n\n' + rows.join('\n');
    }
}

// Make available globally
window.PDFProcessor = PDFProcessor;
