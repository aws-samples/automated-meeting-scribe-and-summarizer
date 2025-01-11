import Flashbar from "@cloudscape-design/components/flashbar";
import { createContext, useContext, useState } from "react";

type FlashbarType = "error" | "info" | "warning" | "success";

export interface FlashbarItem {
    type: FlashbarType;
    content: string;
}

const FlashbarContext = createContext<{
    flashbarItems: FlashbarItem[];
    updateFlashbar: (type: FlashbarType, content: string) => void;
    handleDismiss: (index: number) => void;
}>({
    flashbarItems: [],
    updateFlashbar: () => {},
    handleDismiss: () => {},
});

export const FlashbarProvider = ({
    children,
}: {
    children: React.ReactNode;
}) => {
    const [flashbarItems, setFlashbarItems] = useState<FlashbarItem[]>([]);

    const updateFlashbar = (type: FlashbarType, content: string) => {
        setFlashbarItems((prevItems) => [...prevItems, { type, content }]);
    };

    const handleDismiss = (index: number) => {
        setFlashbarItems((prevItems) =>
            prevItems.filter((_, i) => i !== index)
        );
    };

    const contextValue = {
        flashbarItems,
        updateFlashbar,
        handleDismiss,
    };

    return (
        <FlashbarContext.Provider value={contextValue}>
            {children}
        </FlashbarContext.Provider>
    );
};

export const FlashbarComponent = () => {
    const { flashbarItems, handleDismiss } = useContext(FlashbarContext);

    return (
        <Flashbar
            items={flashbarItems.map((item, index) => ({
                type: item.type,
                dismissible: true,
                dismissLabel: "Dismiss",
                onDismiss: () => handleDismiss(index),
                content: item.content,
            }))}
            // stackItems
        />
    );
};

export default FlashbarContext;
