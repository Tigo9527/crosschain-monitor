import {Table, Tag, Space, Divider, Row, Col} from 'antd';
import React, {useEffect, useState} from "react";
function MinterTable({addr, minters, totalSupply, totalUnit, addressMap}) {
    minters.forEach(row=>row.key = row.minterAddr)
    const columns = [
        {
            title: 'Minter Addr',
            dataIndex: 'minterAddr',
            key: 'name',
            render: (text, row) => (
                <>
                    {addressMap[row.minterName] || row.minterName}
                    <div/>
                    <a href={`https://evm.confluxscan.net/address/${text}`} target='_blank'>{text}</a>
                </>
            ),
        },
        {
            title: 'minterSupply',
            dataIndex: 'minterSupply',
            key: 'minterSupply',
            render: (text, row) => (
                <>
                    {text}
                    <div/>
                    {row.minterSupplyFormat}
                </>
            ),
        }
        // {
        //     title: 'Action',
        //     key: 'action',
        //     render: (text, record) => (
        //         <Space size="middle">
        //             <a>Invite {record.name}</a>
        //             <a>Delete</a>
        //         </Space>
        //     ),
        // },
    ];

    const data = [
        {
            key: '1',
            name: 'John Brown',
            age: 32,
            address: 'New York No. 1 Lake Park',
            tags: ['nice', 'developer'],
        },
        {
            key: '2',
            name: 'Jim Green',
            age: 42,
            address: 'London No. 1 Lake Park',
            tags: ['loser'],
        },
        {
            key: '3',
            name: 'Joe Black',
            age: 32,
            address: 'Sidney No. 1 Lake Park',
            tags: ['cool', 'teacher'],
        },
    ];
    return (
        <React.Fragment>
            <a target={`_blank`} href={`https://evm.confluxscan.net/token/${addr}`}>{addr}</a>
            <Tag>{addressMap[addr]}</Tag>
            <div/>
            Minter Count [{minters?.length || 0}] <Tag>totalSupply</Tag>: {totalSupply} | {totalUnit}
            <Table pagination={false} columns={columns} dataSource={minters} />
        </React.Fragment>
    )
}
function TokenSupply() {
    const [info, setInfo] = useState({tokens: {}, onChain:{}, addressMap:{}})
    useEffect(()=>{
        async function rpc() {
            let url = `http://localhost:3003/supply`;
            url = '/supply'
            const json = await fetch(url, {mode: "cors"}).then(res=>res.json())
            console.log(json)
            setInfo(json)
        }
        rpc().then()
    }, [])
    const transformOnChain = (obj) => {
        const arr:any[] = []
        Object.keys(obj).forEach(k=>{
            if (k === 'totalSupply' || k === 'totalUnit') {

            } else {
                arr.push({minterAddr: k, minterSupply: obj[k].total,
                    minterSupplyFormat: obj[k].totalUnit, minterName: info.addressMap[k],
                    key: k,
                })
            }
        })
        return arr
    }
    return (
        <React.Fragment>
            <Divider/>
           [ {process.env.REACT_APP_HOST}]
            <Row>
                <Col span={12}>
            <Tag color="blue">Off chain</Tag>
            {
                Object.keys(info.tokens).map(k=>{
                    return (
                        <React.Fragment>
                            <Divider key={'d'+k}/>
                            <MinterTable key={k} addr={k}
                                         addressMap={info.addressMap}
                                         totalSupply={info.tokens[k].map(r => BigInt(r.minterSupply)).reduce((a, b) => a + b).toString()}
                                         totalUnit={info.tokens[k].map(r => parseFloat(r.minterSupplyFormat)).reduce((a, b) => a + b)}
                                         minters={info.tokens[k]}/>
                        </React.Fragment>
                    )
                })
            }
                </Col>
                <Col span={1}/>
                <Col span={11}>
            <Tag color="geekblue">On chain</Tag>
            {
                Object.keys(info.onChain).map(k=>{
                    return (
                        <React.Fragment>
                        <Divider key={'dc'+k}/>
                        <MinterTable key={'onChain'+k} addr={k}
                                     addressMap={info.addressMap}
                                         totalSupply={info.onChain[k]['totalSupply']}
                                         totalUnit={info.onChain[k]['totalUnit']}
                                         minters={transformOnChain(info.onChain[k])}/>
                        </React.Fragment>
                    )
                })
            }
                </Col>
            </Row>
        </React.Fragment>
    )
}
export default TokenSupply