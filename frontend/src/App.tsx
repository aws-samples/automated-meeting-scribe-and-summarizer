
import Navigation from "./Components/navigation"
import Layout from "./Components/layout"
import AWS from "./services/exports"

import { Amplify } from 'aws-amplify'
import { withAuthenticator, WithAuthenticatorProps } from '@aws-amplify/ui-react'
import '@aws-amplify/ui-react/styles.css'

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: AWS.USER_POOL_ID,
      userPoolClientId: AWS.USER_POOL_CLIENT_ID
    }
  }
})

function App(authenticatorProps: WithAuthenticatorProps) {
  return (
    <>
      <Navigation authenticatorProps={authenticatorProps} />
      <Layout />
    </>
  )
}

export default withAuthenticator(App, {
  hideSignUp: false
})
