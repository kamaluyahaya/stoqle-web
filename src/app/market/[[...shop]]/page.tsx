import MarketWrapper from "./MarketWrapper";

export const revalidate = 300; // 5 minutes cache invalidation for the server shell

export default function MarketPage(props: { params: Promise<{ shop?: string[] }> }) {
    return (
        <MarketWrapper params={props.params} initialCategories={null} />
    );
}
