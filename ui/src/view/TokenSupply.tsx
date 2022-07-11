import {Table, Tag, Space, Divider, Row, Col, message, Affix, Button, Switch} from 'antd';
import React, {useEffect, useState} from "react";
import {formatEther} from "ethers/lib/utils";
import {LoadingOutlined, CheckOutlined, WarningOutlined, ReloadOutlined} from "@ant-design/icons";
import {getHost} from "../common/Util";
function MinterTable({addr, minters, totalSupply, totalUnit, addressMap, price}) {
    minters.forEach(row=>row.key = row.minterAddr)
    const columns = [
        {
            title: 'Minter Addr',  width: '20%',
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
                    {parseFloat(row.minterSupplyFormat).toLocaleString()}
                    <div/>
                    <span style={{color:'blue'}}>{' $'}
                        {(row.minterSupplyFormat * price).toLocaleString()}</span>
                </>
            ),
        },
        {
            title: 'minterSupply [on chain]',  width: '20%',
            dataIndex: 'onChain.minterSupply',
            key: 'onChain.minterSupply',
            render: (text, row) => (
                <>
                    <span style={{color: 'gray'}}>{row.onChain?.total}</span>
                    <div/>
                    {' '}{parseFloat(row.onChain?.totalUnit).toLocaleString()}
                    <div/>
                    <span style={{color:'blue'}}>{' $'}
                        {(row.onChain?.totalUnit * price).toLocaleString()}</span>
                </>
            ),
        },{
            title: '', key: 'check', width: '20%',
            render: (_, row) => (
                <>
                    {
                        row.minterSupply === row.onChain?.total ?
                            <><CheckOutlined style={{fontSize: '2em', color: "green"}}/></>
                            :
                            <><WarningOutlined style={{fontSize: '2em', color: "darkred"}}/>
                                {' '}Diff: {formatEther((BigInt(row.minterSupply) - BigInt(row.onChain?.total || 0)))}
                            </>
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

    return (
        <React.Fragment key={'tb-1'}>
            <Table pagination={false} columns={columns} dataSource={minters} />
        </React.Fragment>
    )
}
function TokenSummary({tokens}) {
    const columns = [
        {
            title: 'Name', //width: 120,
            dataIndex: 'name',
            key: 'name',
        },  {
            title: 'Value', //width: 120,
            dataIndex: 'amt', key: 'amt', align: 'right' as const,
        }, {
            title: '', key: 'check',// width: '20%',
            render: (_, row) => (
                        row.match ?
                            <CheckOutlined style={{fontSize: '2em', color: "green"}}/>
                            :
                            <WarningOutlined style={{fontSize: '2em', color: "darkred"}}/>
            ),
        }, {
            title: 'Price', //width: '20%',
            dataIndex: 'price',
            key: 'price', align: 'right' as const,
        }, {
            title: 'Supply',// width: '20%',
            dataIndex: 'supplyFmt',
            key: 'supplyFmt', align: 'right' as const,
            render: (text)=>{
                return (parseFloat(text).toLocaleString())
            }
        },

    ]
    return (
        <React.Fragment key={'tb-x'}>
            <Table title={()=>'Summary'} key={'tb-x3'} pagination={false} columns={columns} dataSource={tokens} scroll={{x:400}}/>
        </React.Fragment>
    )
}
function TokenSupply() {
    const [info, setInfo] = useState({tokens: {}, onChain:{}, addressMap:{}, supplyOffChain:{}})
    const [loading, setLoading] = useState(true)
    const [showAllMinter, setShowAllMinter] = useState(false)
    const [priceInfo, setPriceInfo] = useState({'BTCUSDT': 0.0, 'ETHUSDT': 0.0})
    const anyArr:any[] = []
    const [tokenList, setTokenList] = useState(anyArr)
    const getPrice = (name)=>{
        if (name.includes('BTC')) {
            return priceInfo['BTCUSDT']
        } else if (name.includes('Ethereum')) {
            return priceInfo['ETHUSDT']
        } else {
            return 1.0
        }
    }
    function fillPrice() {
        if (priceInfo.ETHUSDT < 1) {
            return
        }
        if (Object.keys(info.tokens).length < 1) {
            return
        }
        const arr: any[] = []
        Object.keys(info.tokens).forEach(k=>{
            // info.tokens[k].price = getPrice(info.addressMap[k])
            const name = info.addressMap[k]
            const sum = info.tokens[k].slice(-1)[0]
            const price = getPrice(name)
            const amt = (sum.minterSupplyFormat * price).toLocaleString()
            const match = sum.minterSupply === sum.onChain.total
            arr.push({name, price, addr: k, amt, match, supplyFmt: sum.minterSupplyFormat})
        })
        setTokenList(arr.sort((b,a)=>a.price - b.price))
    }
    //get price info
    useEffect(()=>{
        const f = async ()=>
        {
            const json = await fetch(`${getHost()}/price-info`, {mode: "cors"}).then(res => res.json())
            const map = {}
            json.list.forEach(row=>{
                map[row.symbol] = parseFloat(row.price)
            })
            // @ts-ignore
            setPriceInfo(map)
        };
        f().then()
    },[info])
    useEffect(()=>{
        fillPrice()
    }, [info, priceInfo])
    const fetchData = ()=>{
        async function rpc() {
            let url = `${getHost()}/supply`;
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
                // json.tokens[tk]
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
            <TokenSummary key={'tk001'} tokens={tokenList}/>
            <Affix offsetTop={10} key={'affix1'}>
            <Row style={{alignItems: 'baseline', backgroundColor:'white', marginTop: '6px'}}>
                <Col key={'c1'} span={4}>Show Minter Detail: <Switch onChange={(c) => {
                    setShowAllMinter(c)
                }}/></Col>
                <Col key={'c2'} span={2}>
                    <Button type="primary" onClick={fetchData}>
                        {loading ? <LoadingOutlined key={'loading1'}/> : <ReloadOutlined key={'btn2'}/>}
                    </Button>
                </Col>
            </Row>
            </Affix>
            {
                Object.keys(info.tokens).map(k=>{
                    return (
                    <React.Fragment key={'rf'+k}>
                    <Row key={'row'+k}>
                        <Col span={24} key={'col1'}>
                            Price: ${getPrice(info.addressMap[k])} { ' ' }
                            <Tag>{info.addressMap[k]}</Tag>
                            <a target={`_blank`} href={`https://evm.confluxscan.net/token/${k}`}>{k}</a>
                            <div style={{padding: '10px'}} />
                            <MinterTable key={k} addr={k} price={getPrice(info.addressMap[k])}
                                         addressMap={info.addressMap}
                                         totalSupply={0}
                                         totalUnit={0}
                                         minters={showAllMinter ? info.tokens[k] : info.tokens[k].slice(-1)}/>
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