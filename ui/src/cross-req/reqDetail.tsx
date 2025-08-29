import React, {useEffect, useState} from 'react';
import { Card, Descriptions, Tag, Button, Space, Typography } from 'antd';
import {getHost} from "../common/Util";
import {TransactionTable, TransactionData} from "./reqTable";

const { Title } = Typography;

export const ReqDetail = ({reqId}: {reqId: string}) => {

    const [data, setData] = useState({detail: {
            "reqId": "",
            "v": 0,
            "created": 0,
            "actionId": 0,
            "tokenIndex": 0,
            "value": "0",
            "fromV": "",
            "toV": "",
            "fromChain": 0,
            "toChain": 0,
            "vault": 0,
            "createdAt": "2025-08-12T17:48:19.000Z",
            "updatedAt": "2025-08-21T10:56:25.000Z"
        }, monitorResult: {
            "id": 9,
            "reqId": "",
            "createdAt": "2025-08-21T10:56:25.000Z",
            "updatedAt": "2025-08-21T10:56:25.000Z",
            "lastCheckTime": "2025-08-21T10:56:25.000Z",
            "lastStatusTime": null,
            "lastAlertTime": null,
            "amount": "0",
            "ruleAction": ""
        }, list: [] as TransactionData[],
        "matchPairResult": {
            "errorMessage": "",
            "ruleAction": "",
            "pairedStep": "", //"Proposed_Executed"
        }})

    useEffect(()=>{
        const fetchData = async () => {
            try {
                // Replace with your actual API call
                const response = await fetch(`${getHost()}/req?reqId=${reqId}`);
                const result = await response.json();
                setData(result);
            } catch (error) {
                console.error('Error fetching data:', error);
            } finally {
                // setLoading(false);
            }
        };

        fetchData();
    }, [reqId])

    return (
        <div>
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
                <Card>
                    <Descriptions title="Request Information" bordered column={1}>
                        <Descriptions.Item label="Request ID">{reqId}</Descriptions.Item>
                        {/*<Descriptions.Item label="Type">*/}
                        {/*    <Tag color="red">{transaction.type}</Tag>*/}
                        {/*</Descriptions.Item>*/}
                        <Descriptions.Item label="Chain ID">{data.detail?.fromChain} - {data.detail?.toChain}</Descriptions.Item>
                        <Descriptions.Item label="Monitor result">{data.monitorResult?.ruleAction
                            || data.matchPairResult?.ruleAction}</Descriptions.Item>
                        <Descriptions.Item label="Matched Progress">{data.matchPairResult?.pairedStep}</Descriptions.Item>
                        <Descriptions.Item label="Created At">{data.detail?.createdAt}</Descriptions.Item>
                        <Descriptions.Item label="Error message">{data.matchPairResult?.errorMessage || '-'}</Descriptions.Item>
                    </Descriptions>
                </Card>
                <Card title={"Events"}>
                    <TransactionTable noReqIdCol={true} count={data.list.length} data={data.list}/>
                </Card>
            </Space>
        </div>
    );
};
