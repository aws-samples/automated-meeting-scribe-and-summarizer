
import {
    createBrowserRouter,
    RouterProvider,
    Navigate
} from "react-router-dom";
import { Amplify } from 'aws-amplify';
import { fetchAuthSession } from 'aws-amplify/auth';
import { WithAuthenticatorProps, withAuthenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import TopNavigation from "@cloudscape-design/components/top-navigation"
import '@cloudscape-design/global-styles/index.css';
import CreateInvite from "./pages/create";
import ListInvites from "./pages/list";
import { FlashbarProvider } from './components/notifications';

const config = await (await fetch('./config.json')).json();
Amplify.configure({
    Auth: {
        Cognito: {
            userPoolId: config.userPoolId,
            userPoolClientId: config.userPoolClientId
        }
    },
    API: {
        REST: {
            restApi: {
                endpoint: config.restApiUrl,
            }
        }
    }
}, {
    API: {
        REST: {
            headers: async () => {
                return {
                    Authorization: `Bearer ${(await fetchAuthSession()).tokens?.idToken}`
                };
            }
        }
    }
});

export function App({ signOut, user }: WithAuthenticatorProps) {

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
        <FlashbarProvider>
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
        </FlashbarProvider>
    )
}

export default withAuthenticator(App);
