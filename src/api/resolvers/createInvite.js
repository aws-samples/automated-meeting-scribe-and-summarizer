
export function request(ctx) {
    const input = ctx.args.input;
    const meeting = [
        input.platform,
        input.id,
        input.password,
        input.time
    ].join('#');

    const names = [
        "Penny",
        "Waffles",
        "Mochi",
        "Scout",
        "Frank",
        "Maddie",
        "Hunter",
        "Barkley",
        "Emma",
        "Jax",
        "Soju",
        "Bowser",
        "Millie",
        "Thomas",
        "Otto",
        "Bailey",
        "Sheriff",
        "Clancy",
        "Dexter",
        "Aria"
    ];
    const scribeName = names[Math.abs(util.crypto.hash(meeting)) % names.length];

    return {
        operation: 'PutItem',
        key: {
            pk: util.dynamodb.toDynamoDB(ctx.identity.claims.email),
            sk: util.dynamodb.toDynamoDB(meeting)
        },
        attributeValues: {
            meeting_expiration: util.dynamodb.toDynamoDB(parseInt(input.time) + 300), // 5 minutes
            meeting_name: util.dynamodb.toDynamoDB(input.name),
            scribe_name: util.dynamodb.toDynamoDB(scribeName)
        }
    };
}

export function response(ctx) {
    const input = ctx.args.input;
    return `${input.name} invite created!`
}
