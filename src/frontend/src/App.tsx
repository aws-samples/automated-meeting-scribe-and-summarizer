
import { Amplify } from 'aws-amplify'
import { withAuthenticator, WithAuthenticatorProps } from '@aws-amplify/ui-react'
import '@aws-amplify/ui-react/styles.css'
import '@cloudscape-design/global-styles/index.css';

import {
    createBrowserRouter,
    RouterProvider,
    Navigate
} from "react-router-dom";

import { FlashbarProvider } from './components/notifications';
import CreateInvite from "./pages/create";
import ListInvites from "./pages/list";
import Navigation from "./components/top_navigation"

Amplify.configure({
    Auth: {
        Cognito: {
            userPoolId: process.env.REACT_APP_USER_POOL_ID!,
            userPoolClientId: process.env.REACT_APP_USER_POOL_CLIENT_ID!
        }
    }
})

function App(authenticatorProps: WithAuthenticatorProps) {

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
            <Navigation authenticatorProps={authenticatorProps} />
            <RouterProvider router={router} />
        </FlashbarProvider>
    )
}

export default withAuthenticator(App, {
    hideSignUp: false
})
