import {Table, Tag, Space, Divider, Row, Col, message, Affix, Button} from 'antd';
import React, {useEffect, useState} from "react";
import {formatEther} from "ethers/lib/utils";
import {LoadingOutlined, CheckOutlined, WarningOutlined, ReloadOutlined} from "@ant-design/icons";
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
            title: 'minterSupply [off chain]',  width: '20%',
            dataIndex: 'minterSupply',
            key: 'minterSupply',
            render: (text, row) => (
                <>
                    <span style={{color: 'gray'}}>{text}</span>
                    <div/>
                    {row.minterSupplyFormat}
                </>
            ),
        },
        {
            title: 'minterSupply [on chain]',  width: '20%',
            dataIndex: 'onChain.minterSupply',
            key: 'onChain.minterSupply',
            render: (text, row) => (
                <>
                    <span style={{color: 'gray'}}>{row.onChain.total}</span>
                    <div/>
                    {row.onChain.totalUnit}
                </>
            ),
        },{
            title: '', key: 'check', width: '10%',
            render: (_, row) => (
                <>
                    {
                        row.minterSupply === row.onChain.total ?
                            <CheckOutlined style={{fontSize:'2em', color: "green"}} /> :
                            <WarningOutlined style={{fontSize:'2em', color: "darkred"}} />
                    }
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
            <Table pagination={false} columns={columns} dataSource={minters} />
        </React.Fragment>
    )
}
function TokenSupply() {
    const [info, setInfo] = useState({tokens: {}, onChain:{}, addressMap:{}, supplyOffChain:{}})
    const [loading, setLoading] = useState(true)
    const fetchData = ()=>{
        async function rpc() {
            let url = `http://localhost:3003/supply`;
            if (process.env.NODE_ENV !== 'development') {
                url = '/supply'
            }
            const json = await fetch(url, {mode: "cors"}).then(res=>res.json())
            if (json.code === 500) {
                message.error(json.message)
                console.log(`rpc fail`, json)
                return
            }
            json.supplyOffChain = {}
            //
            Object.keys(json.tokens).forEach(tk=>{
                const sum = json.tokens[tk].map(r => BigInt(r.minterSupply)).reduce((a, b) => a + b)
                const fmt = formatEther(sum)
                json.supplyOffChain[tk] = {total: sum.toString(), unit: fmt}

                json.tokens[tk].forEach(minter=>{
                    minter.onChain = json.onChain[tk][minter.minterAddr]
                })
                json.tokens[tk].push({
                    minterAddr: '', minterName: '*',
                    minterSupply: sum.toString(), minterSupplyFormat: fmt,
                    onChain: {total: json.onChain[tk].totalSupply, totalUnit: json.onChain[tk].totalUnit},
                })
            })
            console.log(json)
            setInfo(json)
        }
        setLoading(true)
        rpc().then(()=>setLoading(false))
    }
    useEffect(fetchData, [])
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
            <Affix offsetTop={10} key={'affix1'}>
                <Button type="primary" onClick={fetchData}>
                    {loading ? <LoadingOutlined key={'loading1'} /> : <ReloadOutlined key={'btn2'}/>}
                </Button>
            </Affix>
            {
                Object.keys(info.tokens).map(k=>{
                    return (
                    <React.Fragment key={'rf'+k}>
                    <Row key={'row'+k}>
                        <Col span={24} key={'col1'}>
                            <Tag>{info.addressMap[k]}</Tag>
                            <a target={`_blank`} href={`https://evm.confluxscan.net/token/${k}`}>{k}</a>
                            <div style={{padding: '10px'}} />
                            <MinterTable key={k} addr={k}
                                         addressMap={info.addressMap}
                                         totalSupply={0}
                                         totalUnit={0}
                                         minters={info.tokens[k]}/>
                        </Col>
                        {/*<Col span={12}>*/}
                        {/*    <Tag color="geekblue">On chain</Tag>*/}
                        {/*    <MinterTable key={'onChain'+k} addr={k}*/}
                        {/*                 addressMap={info.addressMap}*/}
                        {/*                 totalSupply={info.onChain[k]['totalSupply']}*/}
                        {/*                 totalUnit={info.onChain[k]['totalUnit']}*/}
                        {/*                 minters={transformOnChain(info.onChain[k])}/>*/}
                        {/*</Col>*/}
                    </Row>
                        <div key={'div'+k} style={{padding: '10px'}} />
                    </React.Fragment>
                    )
                })
            }
        </React.Fragment>
    )
}
export default TokenSupply