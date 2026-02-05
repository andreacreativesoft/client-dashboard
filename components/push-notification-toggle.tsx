"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";

export function PushNotificationToggle() {
  const [isSupported, setIsSupported] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check if VAPID is configured
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    setIsConfigured(!!vapidKey);

    // Check if push notifications are supported
    const supported =
      typeof window !== "undefined" &&
      "Notification" in window &&
      "serviceWorker" in navigator &&
      "PushManager" in window;
    setIsSupported(supported);

    if (supported && vapidKey) {
      checkSubscription();
    } else {
      setIsLoading(false);
    }
  }, []);

  async function checkSubscription() {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);
    } catch (err) {
      console.error("Error checking subscription:", err);
    } finally {
      setIsLoading(false);
    }
  }

  async function subscribe() {
    setIsLoading(true);
    setError(null);

    try {
      // Request notification permission
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setError("Permission denied. Please allow notifications in your browser settings.");
        setIsLoading(false);
        return;
      }

      const registration = await navigator.serviceWorker.ready;

      // Get VAPID public key
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        setError("Push notifications not configured");
        setIsLoading(false);
        return;
      }

      // Convert VAPID key to Uint8Array
      const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);

      // Subscribe to push
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey as BufferSource,
      });

      // Send subscription to server
      const response = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });

      if (!response.ok) {
        throw new Error("Failed to save subscription");
      }

      setIsSubscribed(true);
    } catch (err) {
      console.error("Subscribe error:", err);
      setError(err instanceof Error ? err.message : "Failed to enable notifications");
    } finally {
      setIsLoading(false);
    }
  }

  async function unsubscribe() {
    setIsLoading(true);
    setError(null);

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        // Unsubscribe from push
        await subscription.unsubscribe();

        // Remove from server
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
      }

      setIsSubscribed(false);
    } catch (err) {
      console.error("Unsubscribe error:", err);
      setError(err instanceof Error ? err.message : "Failed to disable notifications");
    } finally {
      setIsLoading(false);
    }
  }

  // Not configured - show setup required message
  if (!isConfigured) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-border p-4">
        <div>
          <p className="font-medium">Push Notifications</p>
          <p className="text-sm text-muted-foreground">
            Not configured. VAPID keys required.
          </p>
        </div>
        <Button variant="outline" disabled>
          Not Available
        </Button>
      </div>
    );
  }

  // Browser doesn't support push
  if (!isSupported) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-border p-4">
        <div>
          <p className="font-medium">Push Notifications</p>
          <p className="text-sm text-muted-foreground">
            Not supported in this browser
          </p>
        </div>
        <Button variant="outline" disabled>
          Not Available
        </Button>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-border p-4">
        <div>
          <p className="font-medium">Push Notifications</p>
          <p className="text-sm text-muted-foreground">
            Checking status...
          </p>
        </div>
        <Button variant="outline" disabled>
          ...
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between rounded-lg border border-border p-4">
      <div>
        <p className="font-medium">Push Notifications</p>
        <p className="text-sm text-muted-foreground">
          {isSubscribed
            ? "Enabled - You'll receive instant notifications for new leads"
            : "Get notified instantly when new leads come in"}
        </p>
        {error && <p className="mt-1 text-sm text-destructive">{error}</p>}
      </div>
      <Button
        variant={isSubscribed ? "outline" : "default"}
        onClick={isSubscribed ? unsubscribe : subscribe}
      >
        {isSubscribed ? "Disable" : "Enable"}
      </Button>
    </div>
  );
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
