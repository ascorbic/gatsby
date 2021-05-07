import React, { useState } from "react"
import { formatDistance } from 'date-fns'

import IndicatorButton from "./IndicatorButton"

const infoIcon = <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M11 7H13L13 9H11L11 7ZM11 11H13V17H11V11ZM12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 20C7.59 20 4 16.41 4 12C4 7.59 7.59 4 12 4C16.41 4 20 7.59 20 12C20 16.41 16.41 20 12 20Z" fill="#635E69"/>
</svg>

const getButtonProps = ({ status, createdAt }) => {
  switch (status) {
    case 'SUCCESS':
    case 'ERROR':
    case 'BUILDING': {
      return {
        tooltipText: "",
      }
    }
    case 'UPTODATE': {
      return {
        tooltipText: `Preview updated ${formatDistance(Date.now(), new Date(createdAt), { includeSeconds: true })} ago`,
        active: true,
      }
    }
    default: {
      return {
        tooltipText: "",
      }
    }
  }
}

export default function InfoIndicatorButton({ status, createdAt }) {
  const [button, setButton] = useState()

  const copyLinkClick = () => {
    setButton({ tooltipIcon: successIcon, overrideShowTooltip: true, tooltipText: 'Link copied' })

    setTimeout(() => {
      setButton({ tooltipIcon: successIcon, tooltipText: 'Link copied', overrideShowTooltip: false })
    }, 2000)

    setTimeout(() => {
      setButton({ tooltipText: 'Copy Link' })
    }, 2400)

    navigator.clipboard.writeText(window.location.href)
}

  const buttonProps = getButtonProps({ status, copyLinkClick, createdAt })

  return <IndicatorButton iconSvg={infoIcon} {...buttonProps} toolTipOffset={80 + 12} />
}