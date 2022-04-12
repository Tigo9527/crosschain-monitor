function getHost() {
    let url = ''
    if (process.env.NODE_ENV === 'development') {
        url = 'http://localhost:3003'
        // url = 'http://cross-chain.scan.cab'
    } else {
        url = ''
    }
    return url;
}
export {getHost}