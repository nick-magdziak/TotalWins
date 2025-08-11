import webpush from 'web-push';
import { storage } from '../storage';
import { type User } from '@shared/schema';

// VAPID keys for push notifications
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BEl62iUYgUivxIkv69yViEuiBIa40HdABONFG3LLuJqIXEXrY2yI_bYK2G8X5DSKT6eUNQTW4O4YSMCYwfJPEg';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'GUNtzxQlKZM6ynzA0mJl1v-lhm3_rCJgZoLyWV8JT_k';
const VAPID_EMAIL = process.env.VAPID_EMAIL || 'admin@totalwins.app';

// Configure web-push
webpush.setVapidDetails(
  `mailto:${VAPID_EMAIL}`,
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

export interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: any;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
}

class PushNotificationService {
  /**
   * Get VAPID public key for client-side subscription
   */
  getVapidPublicKey(): string {
    return VAPID_PUBLIC_KEY;
  }

  /**
   * Subscribe a user to push notifications
   */
  async subscribeUser(userId: string, subscription: PushSubscription): Promise<void> {
    try {
      // Store the subscription in the user's profile
      await storage.updateUser(userId, {
        pushSubscription: subscription
      });
      
      console.log(`User ${userId} subscribed to push notifications`);
    } catch (error) {
      console.error('Error subscribing user to push notifications:', error);
      throw error;
    }
  }

  /**
   * Unsubscribe a user from push notifications
   */
  async unsubscribeUser(userId: string): Promise<void> {
    try {
      await storage.updateUser(userId, {
        pushSubscription: null
      });
      
      console.log(`User ${userId} unsubscribed from push notifications`);
    } catch (error) {
      console.error('Error unsubscribing user from push notifications:', error);
      throw error;
    }
  }

  /**
   * Send a push notification to a specific user
   */
  async sendNotificationToUser(userId: string, payload: NotificationPayload): Promise<void> {
    try {
      const user = await storage.getUser(userId);
      if (!user?.pushSubscription) {
        console.log(`User ${userId} has no push subscription`);
        return;
      }

      const notificationPayload = {
        title: payload.title,
        body: payload.body,
        icon: payload.icon || '/total-wins-icon.png',
        badge: payload.badge || '/total-wins-badge.png',
        data: payload.data || {},
        actions: payload.actions || []
      };

      await webpush.sendNotification(
        user.pushSubscription as any,
        JSON.stringify(notificationPayload)
      );

      console.log(`Push notification sent to user ${userId}: ${payload.title}`);
    } catch (error: any) {
      console.error(`Error sending push notification to user ${userId}:`, error);
      
      // If the subscription is invalid, remove it from the user
      if (error?.statusCode === 410 || error?.statusCode === 404) {
        await this.unsubscribeUser(userId);
      }
    }
  }

  /**
   * Send draft turn notification
   */
  async sendDraftTurnNotification(userId: string, leagueName: string, leagueId: string): Promise<void> {
    const user = await storage.getUser(userId);
    if (!user?.draftNotifications) {
      return; // User has disabled draft notifications
    }

    const payload: NotificationPayload = {
      title: "It's Your Turn to Pick!",
      body: `Your turn to draft in ${leagueName}`,
      icon: '/total-wins-icon.png',
      data: {
        type: 'draft_turn',
        leagueId: leagueId,
        url: `/draft?league=${leagueId}`
      },
      actions: [
        {
          action: 'view_draft',
          title: 'View Draft'
        }
      ]
    };

    await this.sendNotificationToUser(userId, payload);
  }

  /**
   * Send standings change notification
   */
  async sendStandingsChangeNotification(
    userId: string, 
    oldPosition: number, 
    newPosition: number, 
    leagueName: string,
    leagueId: string
  ): Promise<void> {
    const user = await storage.getUser(userId);
    if (!user?.standingsNotifications) {
      return; // User has disabled standings notifications
    }

    let title: string;
    let body: string;

    if (newPosition < oldPosition) {
      // User moved up
      if (newPosition === 1) {
        title = "You're in 1st Place!";
        body = `You moved to the top in ${leagueName}`;
      } else {
        title = "You Moved Up!";
        body = `You jumped to ${this.getOrdinal(newPosition)} place in ${leagueName}`;
      }
    } else if (newPosition > oldPosition) {
      // User moved down
      title = "Position Change";
      body = `You dropped to ${this.getOrdinal(newPosition)} place in ${leagueName}`;
    } else {
      // No change, don't send notification
      return;
    }

    const payload: NotificationPayload = {
      title,
      body,
      icon: '/total-wins-icon.png',
      data: {
        type: 'standings_change',
        leagueId: leagueId,
        oldPosition,
        newPosition,
        url: `/standings?league=${leagueId}`
      },
      actions: [
        {
          action: 'view_standings',
          title: 'View Standings'
        }
      ]
    };

    await this.sendNotificationToUser(userId, payload);
  }

  /**
   * Send notifications to all league members about standings changes
   */
  async sendStandingsUpdates(leagueId: string, oldStandings: any[], newStandings: any[]): Promise<void> {
    try {
      const league = await storage.getLeague(leagueId);
      if (!league) return;

      // Create position maps
      const oldPositions = new Map();
      const newPositions = new Map();

      oldStandings.forEach((standing, index) => {
        oldPositions.set(standing.userId, index + 1);
      });

      newStandings.forEach((standing, index) => {
        newPositions.set(standing.userId, index + 1);
      });

      // Send notifications for position changes
      const notificationPromises = newStandings.map(async (standing) => {
        const userId = standing.userId;
        const oldPosition = oldPositions.get(userId) || newPositions.get(userId);
        const newPosition = newPositions.get(userId);

        if (oldPosition !== newPosition) {
          await this.sendStandingsChangeNotification(
            userId,
            oldPosition,
            newPosition,
            league.name,
            leagueId
          );
        }
      });

      await Promise.allSettled(notificationPromises);
      console.log(`Sent standings update notifications for league ${leagueId}`);
    } catch (error) {
      console.error('Error sending standings update notifications:', error);
    }
  }

  /**
   * Convert number to ordinal (1st, 2nd, 3rd, etc.)
   */
  private getOrdinal(num: number): string {
    const suffix = ['th', 'st', 'nd', 'rd'];
    const mod = num % 100;
    return num + (suffix[(mod - 20) % 10] || suffix[mod] || suffix[0]);
  }
}

export const pushNotificationService = new PushNotificationService();