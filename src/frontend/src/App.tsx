import {
    withAuthenticator,
    WithAuthenticatorProps,
} from "@aws-amplify/ui-react";
import "@aws-amplify/ui-react/styles.css";
import TopNavigation from "@cloudscape-design/components/top-navigation";
import "@cloudscape-design/global-styles/index.css";
import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/api";
import { fetchAuthSession } from "aws-amplify/auth";
import { useContext, useEffect } from "react";
import {
    createBrowserRouter,
    Navigate,
    RouterProvider,
} from "react-router-dom";
import FlashbarContext from "./components/notifications";
import { onUpdateInvite } from "./graphql/subscriptions";
import CreateInvite from "./pages/create";
import ListInvites from "./pages/list";

const config = await (await fetch("./config.json")).json();
Amplify.configure(
    {
        Auth: {
            Cognito: {
                userPoolId: config.userPoolId,
                userPoolClientId: config.userPoolClientId,
            },
        },
        API: {
            GraphQL: {
                endpoint: config.graphApiUrl,
                defaultAuthMode: "userPool",
            },
        },
    },
    {
        API: {
            GraphQL: {
                headers: async () => {
                    return {
                        Authorization: `Bearer ${
                            (await fetchAuthSession()).tokens?.idToken
                        }`,
                    };
                },
            },
        },
    }
);

export function App({ signOut, user }: WithAuthenticatorProps) {
    const client = generateClient();
    const { updateFlashbar } = useContext(FlashbarContext);
    useEffect(() => {
        const subscription = client
            .graphql({
                query: onUpdateInvite,
            })
            .subscribe({
                next: ({ data }) => {
                    updateFlashbar(
                        "info",
                        `${data.onUpdateInvite.name}'s status updated to "${data.onUpdateInvite.status}".`
                    );
                },
                error: (error) => {
                    console.error("Subscription error:", error);
                },
            });

        return () => {
            if (subscription) {
                subscription.unsubscribe();
            }
        };
    }, []);

    const router = createBrowserRouter([
        {
            path: "/",
            element: <Navigate to="/create" replace />,
        },
        {
            path: "/create",
            element: <CreateInvite />,
        },
        {
            path: "/list",
            element: <ListInvites />,
        },
    ]);

    return (
        <>
            <TopNavigation
                identity={{
                    href: "/",
                    title: user?.signInDetails?.loginId,
                }}
                utilities={[
                    {
                        type: "button",
                        text: "Logout",
                        onClick: () => signOut!(),
                    },
                ]}
            />
            <RouterProvider router={router} />
        </>
    );
}

export default withAuthenticator(App);
