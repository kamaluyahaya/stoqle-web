/**
 * Utility for calculating delivery estimations in a multi-vendor marketplace.
 */

export interface ShippingPolicy {
    kind: "avg" | "promise" | "delivery_radius_km";
    value: number;
    unit: "hours" | "days" | "weeks" | "km";
}

export interface EstimationResult {
    distance_km: number;
    travel_time_hours: number;
    prep_time_hours: number;
    estimated_delivery_time: Date;
    shipping_deadline: Date;
    is_available: boolean;
    message?: string;
}

const AVERAGE_DELIVERY_SPEED_KMH = 24; // 2.5 minutes per km
const LOGISTICS_BUFFER_HOURS = 0.5; // 30 minutes

import { getDistance } from "geolib";

/**
 * Calculates distance between two points using the geolib library.
 */
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const distanceMeters = getDistance(
        { latitude: lat1, longitude: lon1 },
        { latitude: lat2, longitude: lon2 }
    );
    return distanceMeters / 1000; // Convert to km
}

function convertToHours(value: number, unit: string): number {
    switch (unit) {
        case "days":
            return value * 24;
        case "weeks":
            return value * 24 * 7;
        case "hours":
        default:
            return value;
    }
}

/**
 * Estimates delivery details based on vendor and customer data.
 */
export function estimateDelivery(
    vendorLocation: { latitude: number; longitude: number },
    customerLocation: { latitude: number; longitude: number },
    policies: ShippingPolicy[],
    orderTime: Date = new Date()
): EstimationResult {
    const avgPolicy = policies.find((p: any) => p.kind === "avg" || p.type === "avg");
    const promisePolicy = policies.find((p: any) => p.kind === "promise" || p.type === "promise");
    const radiusPolicy = policies.find((p: any) => p.kind === "delivery_radius_km" || p.type === "delivery_radius_km");

    const distance = calculateDistance(
        vendorLocation.latitude,
        vendorLocation.longitude,
        customerLocation.latitude,
        customerLocation.longitude
    );

    const maxRadius = radiusPolicy ? radiusPolicy.value : Infinity;

    if (distance > maxRadius) {
        return {
            distance_km: parseFloat(distance.toFixed(2)),
            travel_time_hours: 0,
            prep_time_hours: 0,
            estimated_delivery_time: new Date(0),
            shipping_deadline: new Date(0),
            is_available: false,
            message: `Delivery available within ${maxRadius} km\nDistance to you: ${parseFloat(distance.toFixed(1))} km\nThis vendor does not deliver to your location.`,
        };
    }

    const travelTimeHours = distance / AVERAGE_DELIVERY_SPEED_KMH;
    const avgPrepTimeHours = avgPolicy ? convertToHours(avgPolicy.value, avgPolicy.unit) : 0;
    const promiseShipDurationHours = promisePolicy ? convertToHours(promisePolicy.value, promisePolicy.unit) : 0;

    const totalDeliveryTimeHours = avgPrepTimeHours + travelTimeHours + LOGISTICS_BUFFER_HOURS;

    const estimatedDeliveryTime = new Date(orderTime.getTime() + totalDeliveryTimeHours * 60 * 60 * 1000);
    // Adjust promise if estimation exceeds it (Requirement 5)
    const effectivePromiseHours = Math.max(promiseShipDurationHours, totalDeliveryTimeHours);
    const shippingDeadline = new Date(orderTime.getTime() + effectivePromiseHours * 60 * 60 * 1000);

    return {
        distance_km: parseFloat(distance.toFixed(2)),
        travel_time_hours: parseFloat(travelTimeHours.toFixed(2)),
        prep_time_hours: avgPrepTimeHours,
        estimated_delivery_time: estimatedDeliveryTime,
        shipping_deadline: shippingDeadline,
        is_available: true,
    };
}
