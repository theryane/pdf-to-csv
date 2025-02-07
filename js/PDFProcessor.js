// Create a namespace for our application
window.PDFtoCSV = window.PDFtoCSV || {};

// Define the processor class in our namespace
window.PDFtoCSV.Processor = class {
    constructor() {
        this.reset();
    }

    reset() {
        this.activities = [];
        this.currentSection = '';
    }

    async processSchedule(pdfData) {
        try {
            this.reset();
            const pdf = await pdfjsLib.getDocument(pdfData).promise;
            await this.processPages(pdf);
            return this.formatOutput();
        } catch (error) {
            console.error('Error processing PDF:', error);
            throw new Error('Failed to process schedule PDF');
        }
    }

    async processPages(pdf) {
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const textContent = await page.getTextContent();
            this.processItems(textContent.items);
        }
    }

    // ... rest of the processor methods stay the same ...
    processItems(items) {
        const lines = this.groupIntoLines(items);
        lines.forEach(line => {
            const activity = this.parseLine(line);
            if (activity) {
                this.activities.push(activity);
            }
        });
    }

    groupIntoLines(items) {
        const lines = new Map();
        items.forEach(item => {
            const y = Math.round(item.transform[5]);
            if (!lines.has(y)) {
                lines.set(y, []);
            }
            lines.get(y).push({
                text: item.str,
                x: item.transform[4]
            });
        });
        
        return Array.from(lines.values())
            .map(line => line.sort((a, b) => a.x - b.x));
    }

    parseLine(line) {
        const text = line.map(item => item.text).join(' ');
        
        if (this.shouldSkipLine(text)) {
            return null;
        }

        const firstItem = line[0].text;
        if (!this.isActivityId(firstItem)) {
            return null;
        }

        return this.extractActivity(line);
    }

    shouldSkipLine(text) {
        return text.includes('Activity ID') ||
               text.includes('Duration') ||
               text.includes('PAGE') ||
               text.includes('Full WBS') ||
               text.includes('WALTER REED');
    }

    isActivityId(text) {
        return /^(MILE-|P1MILE-|LOE-|SUMM-)/.test(text);
    }

    isDate(text) {
        return /\d{2}-[A-Za-z]{3}-\d{2}/.test(text);
    }

    extractActivity(line) {
        let activity = {
            activityId: '',
            activityName: '',
            originalDuration: '',
            remainingDuration: '',
            startDate: '',
            finishDate: ''
        };

        let nameStarted = false;
        let nameEnded = false;

        line.forEach(item => {
            const text = item.text.trim();

            if (!nameStarted && this.isActivityId(text)) {
                activity.activityId = text;
                nameStarted = true;
                return;
            }

            if (nameStarted && !nameEnded) {
                if (this.isNumber(text) || this.isDate(text)) {
                    nameEnded = true;
                } else {
                    activity.activityName += (activity.activityName ? ' ' : '') + text;
                    return;
                }
            }

            if (nameEnded) {
                if (this.isNumber(text) && !activity.originalDuration) {
                    activity.originalDuration = text;
                } else if (this.isNumber(text) && !activity.remainingDuration) {
                    activity.remainingDuration = text;
                } else if (this.isDate(text)) {
                    if (!activity.startDate) {
                        activity.startDate = this.cleanDate(text);
                    } else if (!activity.finishDate) {
                        activity.finishDate = this.cleanDate(text);
                    }
                }
            }
        });

        return activity;
    }

    isNumber(text) {
        return !isNaN(text) && text.length > 0;
    }

    cleanDate(date) {
        return date.replace(/[*A]$/, '').trim();
    }

    formatOutput() {
        const header = 'Activity ID,Activity Name,Original Duration,Remaining Duration,Start Date,Finish Date';
        const rows = this.activities.map(activity => {
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
};
