import { useEffect, useState } from 'react';
import Purchases, { CustomerInfo } from 'react-native-purchases';
import { GOOGLE_API_KEY_IN_RC } from './constants';

export function useSubscriptionStatus() {
  const [isPro, setIsPro] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const checkProStatus = (info: CustomerInfo) => {
      const entitlementId = 'softywareai Pro';

      const isEntitled = info.entitlements.active[entitlementId]?.isActive ?? false;

      setIsPro(isEntitled);
      console.log(`Subscription Status: ${isEntitled ? 'PRO' : 'FREE'}`);
    };

    const setupAndCheckStatus = async () => {
      try {
        const isConfigured = await Purchases.isConfigured();
        if (!isConfigured) {
          await Purchases.configure({ apiKey: GOOGLE_API_KEY_IN_RC });
        }

        const customerInfo: CustomerInfo = await Purchases.getCustomerInfo();
        checkProStatus(customerInfo);

        Purchases.addCustomerInfoUpdateListener((info) => {
          checkProStatus(info);
        });

      } catch (e) {
        console.error("Subscription check failed:", e);
        setIsPro(false);
      } finally {
        setLoading(false);
      }
    };

    setupAndCheckStatus();
    return () => {
    };
  }, []);

  return { isPro, loading };
}