
import { useState, useContext } from "react"
import { post } from 'aws-amplify/api';
import {
    AppLayout,
    HelpPanel,
    ContentLayout,
    Header,
    Form,
    SpaceBetween,
    FormField,
    Input,
    Select,
    DatePicker,
    TimeInput,
    Alert,
    Checkbox,
    Button,
} from "@cloudscape-design/components";
import NavigationComponent from "../components/navigation";
import FlashbarContext, { FlashbarComponent, FlashbarItem } from '../components/notifications';
import { Meeting, MeetingPlatform, meetingPlatforms } from "../details";

const Create = () => {
    const [navigationOpen, setNavigationOpen] = useState<boolean>(true);
    const { updateFlashbar } = useContext(FlashbarContext);
    const [checked, setChecked] = useState(false);

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

    const submitMeetingForm = async () => {
        if (meetingTime) {
            var meetingDateTime = new Date(meetingDate + "T" + meetingTime)
        } else {
            const coeff = 1000 * 60;
            var meetingDateTime = new Date(Math.ceil(new Date().getTime() / coeff) * coeff);
        }

        const meeting: Meeting = {
            platform: meetingPlatform.value,
            id: meetingId.replace(/ /g, ''),
            password: meetingPassword,
            name: meetingName,
            time: Math.floor(new Date(meetingDateTime.toUTCString()).getTime() / 1000)
        }

        setMeetingId("")
        setMeetingPassword("")
        setMeetingName("")
        setMeetingDate("")
        setMeetingTime("");

        const restOperation = post({
            apiName: 'restApi',
            path: 'post-invite',
            options: {
                body: meeting
            }
        })
        const response = (await (await restOperation.response).body.json() as any) as FlashbarItem;
        updateFlashbar(response.type, response.content)
    }

    return (
        <AppLayout
            navigation={<NavigationComponent />}
            navigationOpen={navigationOpen}
            onNavigationChange={({ detail }) => setNavigationOpen(detail.open)}
            notifications={<FlashbarComponent />}
            toolsHide={false}
            tools={
                <HelpPanel header={<h3>Instructions</h3>}>
                    <ul>
                        <li>To invite a scribe to your upcoming meeting, enter the <strong>Meeting Name</strong>, <strong>Meeting ID</strong>, and, optionally, the <strong>Meeting Time</strong>.</li>
                        <li>Select the checkbox, then click <strong>Invite Now</strong> to invite the scribe to join the meeting as soon as possible or click <strong>Invite Later</strong> to schedule the scribe.</li>
                    </ul>
                </HelpPanel>}
            content={
                <ContentLayout
                    header={<Header description={"Add an AI-assisted scribe to your upcoming meeting."}>Invite</Header>}
                >
                    <form id="meetingForm" onSubmit={(e) => {
                        e.preventDefault();
                        submitMeetingForm()
                    }}>
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

                                {/* <FormField label="Meeting Password">
                                    <Input
                                        onChange={({ detail }) => setMeetingPassword(detail.value)}
                                        value={meetingPassword}
                                        type="password"
                                    />
                                </FormField> */}

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
                                    {meetingTimeError && <Alert type="error"> {meetingTimeError} </Alert>}
                                </FormField>

                                <Checkbox
                                    onChange={({ detail }) =>
                                        setChecked(detail.checked)
                                    }
                                    checked={checked}
                                >
                                    I will not violate legal, corporate, or ethical restrictions that apply to meeting transcription and summarization.
                                </Checkbox>

                                <FormField>
                                    <SpaceBetween direction="horizontal" size="l">
                                        <Button
                                            variant="normal"
                                            form="meetingForm"
                                            disabled={!meetingId || !meetingName || !checked}
                                        >
                                            Invite Now
                                        </Button>
                                        <Button
                                            variant="primary"
                                            form="meetingForm"
                                            disabled={!meetingId || !meetingName || !meetingTime || !!meetingTimeError || !checked}
                                        >
                                            Invite Later
                                        </Button>
                                    </SpaceBetween>
                                </FormField>
                            </SpaceBetween>
                        </Form>
                    </form>
                </ContentLayout>
            }
        />
    )
}

export default Create;
