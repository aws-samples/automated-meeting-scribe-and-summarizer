
export function request(ctx) {
    return {
        operation: 'Query',
        query: {
            expression: '#pk = :email',
            expressionValues: {
                ':email': util.dynamodb.toDynamoDB(ctx.identity.claims.email)
            }
        },
        filter: {
            expression: '#exp >= :minTime',
            expressionNames: {
                '#exp': 'meeting_expiration'
            },
            expressionValues: {
                ':minTime': util.dynamodb.toDynamoDB(util.time.nowEpochSeconds())
            }
        }
    };
}

export function response(ctx) {
    return ctx.result.items.map(item => {
        const [platform, id, password, time] = item.sk.S.split('#');
        return {
            name: item.meeting_name.S,
            platform,
            id,
            password,
            time,
            scribe: item.scribe_name.S
        };
    });
}
