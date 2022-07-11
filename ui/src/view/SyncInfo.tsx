import React, {useEffect, useState} from "react"
import {Affix, Button, Table, Tag} from "antd";
import {LoadingOutlined, CheckOutlined, WarningOutlined, ReloadOutlined} from "@ant-design/icons";
import {getHost} from "../common/Util";

const SyncInfo = ()=>{
    const [list, setList] = useState([])
    const [block, setBlock] = useState({timestamp:0, number: 0})
    const [loading, setLoading] = useState(false)
    const columns = [
        {
            title: 'Token Addr',
            dataIndex: 'name',
            key: 'name',
            render: (text, row) => {
                const addr = row.hex;
                return (
                    <>
                        <a href={`https://evm.confluxscan.net/address/${addr}`} target='_blank'>{row.tokenName || '?'
                        } </a> {addr.substring(0, 6)}...{addr.slice(-4)}
                    </>
                );
            },
        },
        {
            title: 'Epoch',
            dataIndex: 'config',
            key: 'config',
        },
        {
            title: 'Epoch Delay',
            dataIndex: 'delay',
            key: 'delay',
            render: (text, row) => {
                const d = (BigInt(block.number) - BigInt(row.config))
                return (
                    d > 100 ? <Tag color={'darkred'}>{d.toString()}</Tag> :
                    d.toString()
                )
            }
        },
        {
            title: 'updatedAt',
            dataIndex: 'updatedAt',
            key: 'updatedAt',
        },
    ]
    const fetchData = ()=>{
        setLoading(true)
        let host = getHost();
        const f = async ()=>
        {
            const json = await fetch(`${host}/sync-info`, {mode: "cors"}).then(res => res.json())
            Object.keys(json.addressMap).forEach(k=>{
                json.addressMap[k.toLowerCase()] = json.addressMap[k]
            })
            json.list.forEach(row=>{
                const hex = row.name.split("_")[1].toLowerCase()
                const tokenName = json.addressMap[hex]
                row.tokenName = `${tokenName}`
                row.hex = hex;
            })
            setList(json.list)
            setBlock(json.block)
        };
        f().then().catch(err=>{
            console.log(`fetch sync info fail`, err)
        }).finally(()=>{
            setLoading(false)
        })
    }
    useEffect(fetchData,[])
    return (
        <React.Fragment>
                <Button type="primary" onClick={fetchData}>
                    {loading ? <LoadingOutlined key={'loading1'} /> : <ReloadOutlined/>}
                </Button>{' '}
            Latest block time: {new Date(block.timestamp*1000).toISOString()}, number: {block.number}
            <Table key={'tb-3'} pagination={false} columns={columns} dataSource={list} />
        </React.Fragment>
    )
}

export default SyncInfo