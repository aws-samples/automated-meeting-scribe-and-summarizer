
import { useState } from "react"
import { apiCall } from '../api';

import {
    AppLayout,
    ContentLayout,
    Header,
    Form,
    SpaceBetween,
    FormField,
    Input,
    Button,
    Textarea
} from "@cloudscape-design/components";
import NavigationComponent from "../components/navigation";
import { FlashbarComponent } from '../components/notifications';

const Query = () => {
    const [navigationOpen, setNavigationOpen] = useState<boolean>(true);

    const [meetingQuery, setmeetingQuery] = useState("")
    const [meetingResponse, setmeetingResponse] = useState("")

    const submitqueryForm = async () => {
        const response = await apiCall('query-meetings', 'POST', meetingQuery);
        setmeetingResponse(response.content)
        setmeetingQuery("")
    }

    return (
        <AppLayout
            navigation={<NavigationComponent />}
            navigationOpen={navigationOpen}
            onNavigationChange={({ detail }) => setNavigationOpen(detail.open)}
            notifications={<FlashbarComponent />}
            toolsHide={true}
            content={
                <ContentLayout
                    header={<Header description={"Ask about your past meetings."}>Query</Header>}
                >
                    <SpaceBetween direction="vertical" size="l">
                        <form id="queryForm" onSubmit={(e) => {
                            e.preventDefault();
                            submitqueryForm()
                        }}>
                            <Form variant="embedded">
                                <FormField>
                                    <Input
                                        onChange={({ detail }) => setmeetingQuery(detail.value)}
                                        value={meetingQuery}
                                    />
                                </FormField>

                                <FormField>
                                    <Button
                                        variant="normal"
                                        form="queryForm"
                                        disabled={!meetingQuery}
                                    >
                                        Query
                                    </Button>
                                </FormField>
                            </Form>
                        </form>
                        <Textarea
                            value={meetingResponse}
                            readOnly
                        />
                    </SpaceBetween>
                </ContentLayout>
            }
        />
    )
}

export default Query;
