
import { WithAuthenticatorProps } from '@aws-amplify/ui-react'
import TopNavigation from "@cloudscape-design/components/top-navigation"

interface Props {
  authenticatorProps: WithAuthenticatorProps,
}

function Navigation({ authenticatorProps }: Props) {
  const { signOut, user } = authenticatorProps

  return (
    <TopNavigation
      identity={{
        href: "#",
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
  )
}

export default Navigation
