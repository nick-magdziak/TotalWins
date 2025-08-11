import { getCurrentUser } from './auth';

export interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

class PushNotificationManager {
  private vapidPublicKey: string | null = null;

  /**
   * Get VAPID public key from server
   */
  async getVapidPublicKey(): Promise<string> {
    if (this.vapidPublicKey) {
      return this.vapidPublicKey;
    }

    try {
      const response = await fetch('/api/push/vapid-key');
      const data = await response.json();
      this.vapidPublicKey = data.publicKey;
      return this.vapidPublicKey!;
    } catch (error) {
      console.error('Error getting VAPID public key:', error);
      throw error;
    }
  }

  /**
   * Check if push notifications are supported
   */
  isSupported(): boolean {
    return 'serviceWorker' in navigator && 'PushManager' in window;
  }

  /**
   * Check if user has granted push notification permission
   */
  async isPermissionGranted(): Promise<boolean> {
    if (!this.isSupported()) return false;
    
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  /**
   * Request notification permission from user
   */
  async requestPermission(): Promise<boolean> {
    if (!this.isSupported()) {
      throw new Error('Push notifications are not supported in this browser');
    }

    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  /**
   * Get current push subscription
   */
  async getCurrentSubscription(): Promise<PushSubscriptionJSON | null> {
    if (!this.isSupported()) return null;

    try {
      const registration = await navigator.serviceWorker.ready;
      return await registration.pushManager.getSubscription();
    } catch (error) {
      console.error('Error getting current subscription:', error);
      return null;
    }
  }

  /**
   * Subscribe to push notifications
   */
  async subscribe(): Promise<boolean> {
    if (!this.isSupported()) {
      throw new Error('Push notifications are not supported');
    }

    const hasPermission = await this.requestPermission();
    if (!hasPermission) {
      throw new Error('Push notification permission denied');
    }

    try {
      // Register service worker if not already registered
      await this.registerServiceWorker();

      const registration = await navigator.serviceWorker.ready;
      const vapidPublicKey = await this.getVapidPublicKey();

      // Subscribe to push manager
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(vapidPublicKey)
      });

      // Send subscription to server
      const currentUser = getCurrentUser();
      if (!currentUser) {
        throw new Error('User not logged in');
      }

      await this.sendSubscriptionToServer(subscription.toJSON());
      
      console.log('Successfully subscribed to push notifications');
      return true;
    } catch (error) {
      console.error('Error subscribing to push notifications:', error);
      throw error;
    }
  }

  /**
   * Unsubscribe from push notifications
   */
  async unsubscribe(): Promise<boolean> {
    if (!this.isSupported()) return false;

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();
      }

      // Remove subscription from server
      const currentUser = getCurrentUser();
      if (currentUser) {
        await this.removeSubscriptionFromServer();
      }

      console.log('Successfully unsubscribed from push notifications');
      return true;
    } catch (error) {
      console.error('Error unsubscribing from push notifications:', error);
      return false;
    }
  }

  /**
   * Check if user is currently subscribed
   */
  async isSubscribed(): Promise<boolean> {
    const subscription = await this.getCurrentSubscription();
    return subscription !== null;
  }

  /**
   * Register service worker for push notifications
   */
  private async registerServiceWorker(): Promise<void> {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/'
        });
        console.log('Service Worker registered:', registration);
      } catch (error) {
        console.error('Service Worker registration failed:', error);
        throw error;
      }
    }
  }

  /**
   * Send subscription data to server
   */
  private async sendSubscriptionToServer(subscription: PushSubscriptionJSON): Promise<void> {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      throw new Error('User not logged in');
    }

    const response = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId: currentUser.id,
        subscription
      })
    });

    if (!response.ok) {
      throw new Error('Failed to save subscription to server');
    }
  }

  /**
   * Remove subscription from server
   */
  private async removeSubscriptionFromServer(): Promise<void> {
    const currentUser = getCurrentUser();
    if (!currentUser) return;

    const response = await fetch('/api/push/unsubscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId: currentUser.id
      })
    });

    if (!response.ok) {
      console.error('Failed to remove subscription from server');
    }
  }

  /**
   * Convert VAPID key to Uint8Array
   */
  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }
}

export const pushNotificationManager = new PushNotificationManager();