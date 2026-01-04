import { calendar, calendar_v3 } from '@googleapis/calendar';
import { GoogleAuth } from 'google-auth-library';
import { Task } from '../types';
import { logger } from '../logger';
import * as fs from 'fs';
import * as path from 'path';
import { TIMEZONE } from '../config';

const SCOPES = ['https://www.googleapis.com/auth/calendar.events'];

class GoogleCalendarService {
  private calendar: calendar_v3.Calendar | null = null;

  constructor() {
    this.initializeCalendar();
  }

  private initializeCalendar() {
    try {
      const credentialsPath = process.env.GOOGLE_CALENDAR_CREDENTIALS_PATH;
      const calendarId = process.env.GOOGLE_CALENDAR_ID;

      if (!credentialsPath || !calendarId) {
        logger.warn(
          'Google Calendar credentials path or calendar ID not configured, calendar integration disabled',
        );
        return;
      }

      const absolutePath = path.resolve(credentialsPath);
      if (!fs.existsSync(absolutePath)) {
        logger.error(
          `Google Calendar credentials file not found at: ${absolutePath}`,
        );
        return;
      }

      const credentialsContent = fs.readFileSync(absolutePath, 'utf8');
      const credentials = JSON.parse(credentialsContent);

      const auth = new GoogleAuth({
        credentials,
        scopes: SCOPES,
      });

      this.calendar = calendar({ version: 'v3', auth });
      logger.info('Google Calendar service initialized');
    } catch (error) {
      logger.error('Failed to initialize Google Calendar service:', error);
    }
  }

  async createEvent(task: Task): Promise<string | null> {
    if (!this.calendar) {
      logger.warn('Google Calendar not configured, skipping event creation');
      return null;
    }

    if (!task.date || !task.time) {
      logger.debug('Task missing date/time, skipping calendar event creation');
      return null;
    }

    try {
      const calendarId = process.env.GOOGLE_CALENDAR_ID;
      if (!calendarId) {
        throw new Error('GOOGLE_CALENDAR_ID not configured');
      }

      // Parse date and time
      const [year, month, day] = task.date.split('-').map(Number);
      const [hours, minutes] = task.time.split(':').map(Number);

      const startDateTime = new Date(year, month - 1, day, hours, minutes);
      const endDateTime = new Date(startDateTime);

      // Set default duration if not specified
      if (task.duration) {
        const durationMatch = task.duration.match(/(\d+):(\d+)/);
        if (durationMatch) {
          const [, durationHours, durationMinutes] = durationMatch;
          endDateTime.setHours(
            endDateTime.getHours() + parseInt(durationHours),
          );
          endDateTime.setMinutes(
            endDateTime.getMinutes() + parseInt(durationMinutes),
          );
        } else {
          // Default 1 hour duration
          endDateTime.setHours(endDateTime.getHours() + 1);
        }
      } else {
        // Default 1 hour duration
        endDateTime.setHours(endDateTime.getHours() + 1);
      }

      const event = {
        summary: task.name,
        description: task.description || '',
        start: {
          dateTime: startDateTime.toISOString(),
          timeZone: TIMEZONE,
        },
        end: {
          dateTime: endDateTime.toISOString(),
          timeZone: TIMEZONE,
        },
      };

      const response = await this.calendar.events.insert({
        calendarId,
        requestBody: event,
      });

      logger.info(
        `Created calendar event: ${response.data.id} for task: ${task.name}`,
      );
      return response.data.id!;
    } catch (error) {
      logger.error('Failed to create calendar event:', error);
      return null;
    }
  }

  async updateEvent(eventId: string, task: Task): Promise<boolean> {
    if (!this.calendar) {
      return false;
    }

    try {
      const calendarId = process.env.GOOGLE_CALENDAR_ID;
      if (!calendarId) {
        throw new Error('GOOGLE_CALENDAR_ID not configured');
      }

      // Parse date and time
      const [year, month, day] = task.date!.split('-').map(Number);
      const [hours, minutes] = task.time!.split(':').map(Number);

      const startDateTime = new Date(year, month - 1, day, hours, minutes);
      const endDateTime = new Date(startDateTime);

      if (task.duration) {
        const durationMatch = task.duration.match(/(\d+):(\d+)/);
        if (durationMatch) {
          const [, durationHours, durationMinutes] = durationMatch;
          endDateTime.setHours(
            endDateTime.getHours() + parseInt(durationHours),
          );
          endDateTime.setMinutes(
            endDateTime.getMinutes() + parseInt(durationMinutes),
          );
        } else {
          endDateTime.setHours(endDateTime.getHours() + 1);
        }
      } else {
        endDateTime.setHours(endDateTime.getHours() + 1);
      }

      const event = {
        summary: task.name,
        description: task.description || '',
        start: {
          dateTime: startDateTime.toISOString(),
          timeZone: TIMEZONE,
        },
        end: {
          dateTime: endDateTime.toISOString(),
          timeZone: TIMEZONE,
        },
      };

      await this.calendar.events.update({
        calendarId,
        eventId,
        requestBody: event,
      });

      logger.info(`Updated calendar event: ${eventId} for task: ${task.name}`);
      return true;
    } catch (error) {
      logger.error('Failed to update calendar event:', error);
      return false;
    }
  }

  async deleteEvent(eventId: string): Promise<boolean> {
    if (!this.calendar) {
      return false;
    }

    try {
      const calendarId = process.env.GOOGLE_CALENDAR_ID;
      if (!calendarId) {
        throw new Error('GOOGLE_CALENDAR_ID not configured');
      }

      await this.calendar.events.delete({
        calendarId,
        eventId,
      });

      logger.info(`Deleted calendar event: ${eventId}`);
      return true;
    } catch (error) {
      logger.error('Failed to delete calendar event:', error);
      return false;
    }
  }
}

// Export singleton instance
export const googleCalendarService = new GoogleCalendarService();
