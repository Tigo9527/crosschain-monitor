import React, {useEffect, useState} from "react"
import {Affix, Button, Table, Tag} from "antd";
import {LoadingOutlined, CheckOutlined, WarningOutlined, ReloadOutlined} from "@ant-design/icons";
import {getHost} from "../common/Util";

const PriceInfo = ()=>{
    const [list, setList] = useState([])
    const [loading, setLoading] = useState(false)
    const columns = [
        {
            title: 'Token',
            dataIndex: 'symbol',            key: 'symbol',
        },
        {
            title: 'Price',
            dataIndex: 'price',            key: 'price',
        },
    ]
    const fetchData = ()=>{
        setLoading(true)
        let host = getHost();
        const f = async ()=>
        {
            const json = await fetch(`${host}/price-info`, {mode: "cors"}).then(res => res.json())
            setList(json.list)
        };
        f().then().catch(err=>{
            console.log(`fetch price info fail`, err)
        }).finally(()=>{
            setLoading(false)
        })
    }
    useEffect(fetchData,[])
    return (
        <React.Fragment>
                <Button type="primary" onClick={fetchData}>
                    {loading ? <LoadingOutlined key={'loading1'} /> : <ReloadOutlined/>} PriceInfo
                </Button>
            <Table key={'tb-3'} pagination={false} columns={columns} dataSource={list} />
        </React.Fragment>
    )
}

export default PriceInfo