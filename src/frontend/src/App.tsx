
import { Amplify } from 'aws-amplify';
import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import TopNavigation from "@cloudscape-design/components/top-navigation"
import '@cloudscape-design/global-styles/index.css';

import {
    createBrowserRouter,
    RouterProvider,
    Navigate
} from "react-router-dom";

import { FlashbarProvider } from './components/notifications';
import CreateInvite from "./pages/create";
import ListInvites from "./pages/list";

const config = await (await fetch('./config.json')).json();

Amplify.configure({
    Auth: {
        Cognito: {
            userPoolId: config.userPoolId,
            userPoolClientId: config.userPoolClientId
        }
    }
});

export default function App() {

    const router = createBrowserRouter([
        {
            path: "/",
            element: <Navigate to="/create" replace />
        },
        {
            path: "/create",
            element: <CreateInvite />
        },
        {
            path: "/list",
            element: <ListInvites />
        },
    ]);

    return (
        <Authenticator>
            {({ signOut, user }) => (
                <FlashbarProvider>
                    <TopNavigation
                        identity={{
                            href: "",
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
                </FlashbarProvider>
            )}
        </Authenticator>
    )
}
