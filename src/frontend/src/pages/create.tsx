import {
    Alert,
    AppLayout,
    Button,
    Checkbox,
    ContentLayout,
    DatePicker,
    Form,
    FormField,
    Header,
    HelpPanel,
    Input,
    Select,
    SpaceBetween,
    TimeInput,
} from "@cloudscape-design/components";
import { generateClient } from "aws-amplify/api";
import { useContext, useState } from "react";
import { CreateInviteInput } from "../API";
import NavigationComponent from "../components/navigation";
import FlashbarContext, {
    FlashbarComponent,
} from "../components/notifications";
import { createInvite } from "../graphql/mutations";
import { MeetingPlatform, meetingPlatforms } from "../platform";

const Create = () => {
    const [navigationOpen, setNavigationOpen] = useState<boolean>(true);
    const { updateFlashbar } = useContext(FlashbarContext);
    const [checked, setChecked] = useState(false);

    const [inviteName, setInviteName] = useState("");
    const [meetingPlatform, setMeetingPlatform] = useState(meetingPlatforms[0]);
    const [meetingId, setMeetingId] = useState("");
    const [meetingPassword, setMeetingPassword] = useState("");
    const [meetingDate, setMeetingDate] = useState("");
    const [meetingTime, setMeetingTime] = useState("");

    const [meetingTimeError, setMeetingTimeError] = useState("");

    const validateMeetingTime = (time: string) => {
        if (!time) {
            setMeetingTimeError("");
        } else if (time.length !== 5) {
            setMeetingTimeError("Meeting time is incomplete.");
        } else {
            var meetingDateTime = new Date(meetingDate);
            meetingDateTime.setDate(meetingDateTime.getDate() + 1);
            const [hour, minute] = time.split(":").map(Number);
            meetingDateTime.setHours(hour, minute, 0, 0);

            const minuteDifference =
                (meetingDateTime.getTime() - new Date().getTime()) /
                (1000 * 60);

            if (minuteDifference >= 2) {
                setMeetingTimeError("");
            } else {
                setMeetingTimeError(
                    "Meeting time must be at least two minutes out from now."
                );
            }
        }
    };

    const submitMeetingForm = async () => {
        if (meetingTime) {
            var meetingDateTime = new Date(meetingDate + "T" + meetingTime);
        } else {
            const coeff = 1000 * 60;
            var meetingDateTime = new Date(
                Math.ceil(new Date().getTime() / coeff) * coeff
            );
        }

        const input: CreateInviteInput = {
            name: inviteName,
            meetingPlatform: meetingPlatform.value,
            meetingId: meetingId.replace(/ /g, ""),
            meetingTime: Math.floor(
                new Date(meetingDateTime.toUTCString()).getTime() / 1000
            ),
            ...(meetingPassword ? { meetingPassword: meetingPassword } : {}),
        };

        setInviteName("");
        setMeetingId("");
        setMeetingPassword("");
        setMeetingDate("");
        setMeetingTime("");

        const client = generateClient();
        try {
            await client.graphql({
                query: createInvite,
                variables: {
                    input: input,
                },
            });
            updateFlashbar("success", `${input.name} invite created!`);
        } catch (error) {
            const errorMessage = "Failed to create invite.";
            console.error(errorMessage, error);
            updateFlashbar("error", errorMessage);
        }
    };

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
                        <li>
                            To invite a scribe to your upcoming meeting, enter
                            the <strong>Invite Name</strong>,{" "}
                            <strong>Meeting ID</strong>, and, optionally, the{" "}
                            <strong>Meeting Time</strong>.
                        </li>
                        <li>
                            Select the checkbox, then click{" "}
                            <strong>Invite Now</strong> to invite the scribe to
                            join the meeting as soon as possible or click{" "}
                            <strong>Invite Later</strong> to schedule the
                            scribe.
                        </li>
                    </ul>
                </HelpPanel>
            }
            content={
                <ContentLayout
                    header={
                        <Header
                            description={
                                "Add an AI-assisted scribe to your upcoming meeting."
                            }
                        >
                            Invite
                        </Header>
                    }
                >
                    <form
                        id="meetingForm"
                        onSubmit={(e) => {
                            e.preventDefault();
                            submitMeetingForm();
                        }}
                    >
                        <Form variant="embedded">
                            <SpaceBetween direction="vertical" size="l">
                                <FormField label="Invite Name">
                                    <Input
                                        onChange={({ detail }) =>
                                            setInviteName(detail.value)
                                        }
                                        value={inviteName}
                                    />
                                </FormField>

                                <FormField label="Meeting Platform">
                                    <Select
                                        onChange={({ detail }) =>
                                            setMeetingPlatform(
                                                detail.selectedOption as MeetingPlatform
                                            )
                                        }
                                        options={meetingPlatforms}
                                        selectedOption={meetingPlatform}
                                    />
                                </FormField>

                                <FormField label="Meeting ID">
                                    <Input
                                        onChange={({ detail }) =>
                                            setMeetingId(detail.value)
                                        }
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
                                    <SpaceBetween
                                        direction="horizontal"
                                        size="l"
                                    >
                                        <DatePicker
                                            onChange={({ detail }) =>
                                                setMeetingDate(detail.value)
                                            }
                                            onBlur={() =>
                                                validateMeetingTime(meetingTime)
                                            }
                                            value={meetingDate}
                                            isDateEnabled={(date) => {
                                                var currentDate = new Date();
                                                currentDate.setDate(
                                                    currentDate.getDate() - 1
                                                );
                                                return date > currentDate;
                                            }}
                                            placeholder="YYYY/MM/DD"
                                            controlId="date"
                                        />
                                        <TimeInput
                                            onChange={({ detail }) =>
                                                setMeetingTime(detail.value)
                                            }
                                            onBlur={() =>
                                                validateMeetingTime(meetingTime)
                                            }
                                            value={meetingTime}
                                            disabled={meetingDate.length !== 10}
                                            format="hh:mm"
                                            placeholder="hh:mm (24-hour format)"
                                            use24Hour={true}
                                        />
                                    </SpaceBetween>
                                    {meetingTimeError && (
                                        <Alert type="error">
                                            {" "}
                                            {meetingTimeError}{" "}
                                        </Alert>
                                    )}
                                </FormField>

                                <Checkbox
                                    onChange={({ detail }) =>
                                        setChecked(detail.checked)
                                    }
                                    checked={checked}
                                >
                                    I will not violate legal, corporate, or
                                    ethical restrictions that apply to meeting
                                    transcription and summarization.
                                </Checkbox>

                                <FormField>
                                    <SpaceBetween
                                        direction="horizontal"
                                        size="l"
                                    >
                                        <Button
                                            variant="normal"
                                            form="meetingForm"
                                            disabled={
                                                !meetingId ||
                                                !inviteName ||
                                                !checked
                                            }
                                        >
                                            Invite Now
                                        </Button>
                                        <Button
                                            variant="primary"
                                            form="meetingForm"
                                            disabled={
                                                !meetingId ||
                                                !inviteName ||
                                                !meetingTime ||
                                                !!meetingTimeError ||
                                                !checked
                                            }
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
    );
};

export default Create;
