
import scheduleService, { Schedule } from '../services/details'
import { HttpService } from '../services/http'
import { CanceledError } from '../services/client'
import MeetingForm from './form'
import MeetingList from './list'
import { useEffect, useState } from 'react'
import { fetchAuthSession } from 'aws-amplify/auth'
import { I18nProvider } from '@cloudscape-design/components/i18n'
import messages from '@cloudscape-design/components/i18n/messages/all.en'
import SpaceBetween from "@cloudscape-design/components/space-between"
import {
  AppLayout,
  Flashbar,
  ContentLayout,
  Container,
  Header,
} from '@cloudscape-design/components'

export type Meeting = {
  meetingPlatform: string,
  meetingID: string,
  meetingPassword: string,
  meetingName: string,
  meetingTime: string
}

interface CustomMessage {
  type: string,
  dismissible: boolean,
  dismissLabel: string,
  onDismiss: () => void,
  content: any,
  id: string
}

function Layout() {
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [message, setMessage] = useState<CustomMessage[]>()
  var meetingApi: HttpService | null

  async function initializeMeetingApi() {
    if (!meetingApi) {
      const { idToken } = (await fetchAuthSession()).tokens ?? {}
      if (idToken?.toString()) {
        meetingApi = scheduleService('/Scribe', idToken?.toString())!
      } else {
        throw new Error('Failed to retrieve token.')
      }
    }
    return meetingApi
  }

  function setMessageProperties(message: any, type: "error" | "success") {
    setMessage([{
      type: type,
      dismissible: true,
      dismissLabel: "Dismiss",
      onDismiss: () => setMessage([]),
      content: (
        <>
          {message}
        </>
      ),
      id: "message_1"
    }])
  }

  useEffect(() => {
    async function initializeSession() {
      try {
        const initializedMeetingApi = await initializeMeetingApi()
        const { request, cancel } = initializedMeetingApi.getAll<Schedule>()

        request.then((response) => {
          setSchedules(response.data)
          setMessage([])
        }).catch((err) => {
          if (!(err instanceof CanceledError)) {
            setMessageProperties(err.message, "error")
          }
        })
        return () => cancel()

      } catch (err) {
        setMessageProperties((err as Error).message, "error")
      }
    }
    initializeSession()
  }, [])

  const createInvite = async (meeting: Meeting) => {
    const initializedMeetingApi = await initializeMeetingApi()
    const schedulesCopy = [...schedules]

    initializedMeetingApi.post<Meeting>(meeting).then(() => {
      const { request } = initializedMeetingApi.getAll<Schedule>()

      request.then((response) => {
        setSchedules(response.data)
      }).catch((err) => {
        setMessageProperties((err as Error).message, "error")
      }).finally(() => {
        setMessageProperties(meeting.meetingName + " invite created!", "success")
      })

    }).catch(err => {
      setMessageProperties((err as Error).message, "error")
      setSchedules(schedulesCopy)
    })
  }

  const deleteInvites = async (selectedItems: Schedule[]) => {
    if (selectedItems.length !== 0) {
      const initializedMeetingApi = await initializeMeetingApi()
      let schedulesCopy = [...schedules]

      selectedItems.forEach((selectedItem) => {
        const meetingProperties = {
          "meetingName": selectedItem.Name
        }

        initializedMeetingApi.delete<{
          meetingName: string
        }>(meetingProperties).then(() => {
          schedulesCopy = schedulesCopy.filter(schedule => schedule.Name !== selectedItem.Name)
          setSchedules([...schedulesCopy])
        }).catch(err => {
          setMessageProperties((err as Error).message, "error")
        }).finally(() => {
          setMessageProperties("Selected invite(s) deleted!", "success")
        })
      })
    }
  }

  return (
    <I18nProvider locale={'en'} messages={[messages]}>
      <AppLayout
        navigationHide={true}
        toolsHide={true}
        notifications={
          message?.length !== 0 && (
            <Flashbar
              items={message ? message as any : []}
            />
          )
        }
        content={
          <ContentLayout header={<Header variant="h1" /*info={<Link variant="info">Info</Link>}*/ >Automated Meeting Scribe and Summarizer</Header>}>
            <SpaceBetween direction="vertical" size="l">

              <Container header={
                <Header variant="h2" description="Add an AI-assisted scribe to your upcoming meeting.">
                  Invite
                </Header>}>
                <MeetingForm createInvite={createInvite}></MeetingForm>
              </Container>

              <Container>
                <MeetingList schedules={schedules} deleteInvites={deleteInvites} />
              </Container>

            </SpaceBetween>
          </ContentLayout>
        }
      />
    </I18nProvider>
  )
}

export default Layout
