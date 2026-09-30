import { FirestoreService } from '../firebase/firestoreService';
import { EmergencyAlert, EmergencyType } from '../../types/security.types';
import { UserProfile } from '../../types';
import { SchoolBellService } from '../audio/bellService';

export class EmergencyService {
  private static readonly EMERGENCY_DOC_ID = 'active_emergency_broadcast';

  /**
   * Request browser desktop notification permission
   */
  public static async requestNotificationPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      return 'denied';
    }
    try {
      return await Notification.requestPermission();
    } catch (e) {
      console.warn('Failed to request notification permission:', e);
      return 'denied';
    }
  }

  /**
   * Send a browser desktop notification
   */
  public static sendDesktopNotification(title: string, options?: NotificationOptions) {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted') {
      try {
        new Notification(title, {
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          ...options,
        });
      } catch (e) {
        console.warn('Notification trigger error:', e);
      }
    }
  }

  /**
   * Broadcast an emergency alarm across the school network
   */
  public static async triggerEmergency(
    type: EmergencyType,
    title: string,
    message: string,
    currentUser: UserProfile,
    playAudio: boolean = true
  ): Promise<EmergencyAlert> {
    const newAlert: EmergencyAlert = {
      id: this.EMERGENCY_DOC_ID,
      type,
      title,
      message,
      isActive: true,
      triggeredBy: currentUser.id,
      triggeredByName: currentUser.fullName,
      triggeredAt: new Date().toISOString(),
      soundAlert: playAudio,
    };

    // Store in Firestore
    await FirestoreService.setDocument('emergencies', this.EMERGENCY_DOC_ID, newAlert);

    // Also store history
    const historyId = `EMG-${Date.now()}`;
    await FirestoreService.setDocument('emergency_history', historyId, {
      ...newAlert,
      id: historyId,
    });

    // Audit log
    await FirestoreService.logAudit({
      userId: currentUser.id,
      userName: currentUser.fullName,
      role: currentUser.role,
      action: 'EMERGENCY',
      module: 'SECURITY',
      details: `BROADCAST DARURAT DIAKTIFKAN: [${type}] ${title} - ${message}`,
    });

    // Play audible siren
    if (playAudio) {
      if (type === 'EARTHQUAKE') {
        SchoolBellService.playEarthquakeAlarm();
      } else if (type === 'FIRE') {
        SchoolBellService.playFireAlarm();
      } else {
        SchoolBellService.playEmergencyAlarm();
      }
    }

    // Trigger Desktop Notification
    this.sendDesktopNotification(`🚨 SIAGA DARURAT: ${title}`, {
      body: message,
      requireInteraction: true,
    });

    return newAlert;
  }

  /**
   * Resolve / Cancel an active emergency alert
   */
  public static async resolveEmergency(
    currentUser: UserProfile,
    resolutionNote: string = 'Situasi telah terkendali dan status siaga dinyatakan selesai.'
  ): Promise<void> {
    const active = await FirestoreService.getById<EmergencyAlert>('emergencies', this.EMERGENCY_DOC_ID);
    
    if (active && active.isActive) {
      const updated: EmergencyAlert = {
        ...active,
        isActive: false,
        resolvedAt: new Date().toISOString(),
        resolvedBy: currentUser.id,
        resolvedByName: currentUser.fullName,
      };

      await FirestoreService.setDocument('emergencies', this.EMERGENCY_DOC_ID, updated);

      // Log audit
      await FirestoreService.logAudit({
        userId: currentUser.id,
        userName: currentUser.fullName,
        role: currentUser.role,
        action: 'SECURITY',
        module: 'SECURITY',
        details: `STATUS SIAGA DARURAT DICABUT: ${resolutionNote}`,
      });

      this.sendDesktopNotification('✅ SIAGA DARURAT BERAKHIR', {
        body: resolutionNote,
      });
    }
  }

  /**
   * Realtime subscription for active emergency
   */
  public static subscribeToActiveEmergency(callback: (alert: EmergencyAlert | null) => void): () => void {
    return FirestoreService.subscribeToDocument<EmergencyAlert>(
      'emergencies',
      this.EMERGENCY_DOC_ID,
      (data) => {
        if (data && data.isActive) {
          callback(data);
        } else {
          callback(null);
        }
      }
    );
  }
}
