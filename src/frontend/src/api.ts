
import { FlashbarItem } from './components/notifications';
import { fetchAuthSession } from 'aws-amplify/auth';

type Body = FlashbarItem & {
    invites?: any;
};

export const apiCall = async (endpoint: string, method: string, body?: any): Promise<Body> => {
    try {
        const config = await (await fetch('./config.json')).json();
        const id_token = (await fetchAuthSession()).tokens?.idToken;

        const response = await fetch(`${config.restApiUrl}${endpoint}`, {
            credentials: 'include',
            method: method,
            body: body ? JSON.stringify(body) : undefined,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${id_token}`
            }
        });
        const response_body = await response.json()
        return response_body;
    } catch (err: unknown) {
        if (err instanceof Error) {
            return {
                "type": "error",
                "content": err.toString()
            }
        } else {
            return {
                "type": "error",
                "content": "An unknown error occurred"
            }
        }
    }
}
