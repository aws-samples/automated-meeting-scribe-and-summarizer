
import { Meeting } from "./layout"
import { meetingPlatforms, MeetingPlatform } from '../services/details'
import { useState } from "react"
import Form from "@cloudscape-design/components/form"
import SpaceBetween from "@cloudscape-design/components/space-between"
import FormField from "@cloudscape-design/components/form-field"
import Input from "@cloudscape-design/components/input"
import Select from "@cloudscape-design/components/select"
import Alert from "@cloudscape-design/components/alert"
import DatePicker from "@cloudscape-design/components/date-picker"
import TimeInput from "@cloudscape-design/components/time-input"
import Button from "@cloudscape-design/components/button"

interface Props {
  createInvite: (meeting: Meeting) => void,
}

export default ({ createInvite }: Props) => {
  const [meetingPlatform, setMeetingPlatform] = useState(meetingPlatforms[0])
  const [meetingId, setMeetingId] = useState("")
  const [meetingPassword, setMeetingPassword] = useState("")
  const [meetingName, setMeetingName] = useState("")
  const [meetingDate, setMeetingDate] = useState("")
  const [meetingTime, setMeetingTime] = useState("")

  const [meetingTimeError, setMeetingTimeError] = useState("")

  const validateMeetingTime = (time: string) => {
    if (!time) {
      setMeetingTimeError('')
    } else if (time.length !== 5) {
      setMeetingTimeError('Meeting time is incomplete.')
    } else {
      var meetingDateTime = new Date(meetingDate)
      meetingDateTime.setDate(meetingDateTime.getDate() + 1)
      const [hour, minute] = time.split(":").map(Number)
      meetingDateTime.setHours(hour, minute, 0, 0)

      const minuteDifference = (meetingDateTime.getTime() - new Date().getTime()) / (1000 * 60)

      if (minuteDifference >= 2) {
        setMeetingTimeError('')
      } else {
        setMeetingTimeError('Meeting time must be at least two minutes out from now.')
      }
    }
  }

  const submitMeetingForm = () => {
    var meetingDateTimeFormatted = ""
    if (meetingTime) {
      var meetingDateTime = new Date(meetingDate + "T" + meetingTime)
      meetingDateTime.setMinutes(meetingDateTime.getMinutes() - 2)
      meetingDateTimeFormatted = meetingDateTime.toISOString().slice(0, -5)
    }

    const meeting = {
      meetingPlatform: meetingPlatform.value,
      meetingID: meetingId.replace(/ /g, ''),
      meetingPassword: meetingPassword,
      meetingName: meetingName,
      meetingTime: meetingDateTimeFormatted
    }

    createInvite(meeting)

    setMeetingId("")
    setMeetingPassword("")
    setMeetingName("")
    setMeetingDate("")
    setMeetingTime("")
  }

  return (
    <form id="meetingForm" onSubmit={(e) => { e.preventDefault(); submitMeetingForm() }}>
      <Form variant="embedded">
        <SpaceBetween direction="vertical" size="l">

          <FormField label="Meeting Name">
            <Input
              onChange={({ detail }) => setMeetingName(detail.value)}
              value={meetingName}
            />
          </FormField>

          <FormField label="Meeting Platform">
            <Select
              onChange={({ detail }) => setMeetingPlatform(detail.selectedOption as MeetingPlatform)}
              options={meetingPlatforms}
              selectedOption={meetingPlatform}
            />
          </FormField>

          <FormField label="Meeting ID">
            <Input
              onChange={({ detail }) => setMeetingId(detail.value)}
              value={meetingId}
            />
          </FormField>

          <FormField label="Meeting Password">
            <Input
              onChange={({ detail }) => setMeetingPassword(detail.value)}
              value={meetingPassword}
              type="password"
            />
          </FormField>

          <FormField
            label="Meeting Time"
            description="Choose a date and local time that is at least two minutes out from now."
          >
            <SpaceBetween direction="horizontal" size="l">
              <DatePicker
                onChange={({ detail }) => setMeetingDate(detail.value)}
                onBlur={() => validateMeetingTime(meetingTime)}
                value={meetingDate}
                isDateEnabled={date => {
                  var currentDate = new Date()
                  currentDate.setDate(currentDate.getDate() - 1)
                  return date > currentDate
                }}
                placeholder="YYYY/MM/DD"
                controlId="date"
              />
              <TimeInput
                onChange={({ detail }) => setMeetingTime(detail.value)}
                onBlur={() => validateMeetingTime(meetingTime)}
                value={meetingTime}
                disabled={meetingDate.length !== 10}
                format="hh:mm"
                placeholder="hh:mm (24-hour format)"
                use24Hour={true}
              />
            </SpaceBetween>
            {meetingTimeError && <Alert
              type="error"
            >
              {meetingTimeError}
            </Alert>}
          </FormField>

          <FormField>
            <SpaceBetween direction="horizontal" size="l">
              <Button
                variant="normal"
                form="meetingForm"
                disabled={!meetingId || !meetingName}
              >
                Invite Now
              </Button>
              <Button
                variant="primary"
                form="meetingForm"
                disabled={!meetingId || !meetingName || !meetingTime || !!meetingTimeError}
              >
                Invite Later
              </Button>
            </SpaceBetween>
          </FormField>

        </SpaceBetween>
      </Form>
    </form>
  )
}
